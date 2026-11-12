import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AiError, createGemini, retryDelayMs } from '../src/gemini.js';
import { MemoryStore } from '../src/store.js';
import { testConfig } from './fakes.js';

const Schema = z.object({ ok: z.boolean() });
const answer = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });
const rateLimited = (seconds: number) =>
  new Response(JSON.stringify({ error: { code: 429, details: [{ '@type': 'RetryInfo', retryDelay: `${seconds}s` }] } }), { status: 429 });

function setup(responses: ((model: string) => Response)[], env: Record<string, string> = {}) {
  let t = 0;
  const clock = { now: () => t, sleep: async (ms: number) => { t += ms; } };
  const calls: string[] = [];
  const doFetch = (async (url: string) => {
    const model = /models\/([^:]+):/.exec(url)![1]!;
    calls.push(model);
    const next = responses.shift();
    if (!next) throw new Error('unexpected call');
    return next(model);
  }) as unknown as typeof fetch;
  const store = new MemoryStore();
  const gem = createGemini(testConfig({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'main', GEMINI_FALLBACK_MODEL: 'lite', ...env }), store, doFetch, clock);
  const run = () => gem.generateJson({ system: 's', prompt: 'p', schema: Schema });
  return { run, calls, store, elapsed: () => t };
}

describe('gemini client', () => {
  it('parses Google retry delays', () => {
    expect(retryDelayMs({ error: { details: [{ retryDelay: '17s' }] } })).toBe(17000);
    expect(retryDelayMs({ error: { details: [{ retryDelay: '0.5s' }] } })).toBe(500);
    expect(retryDelayMs({})).toBeNull();
  });

  it('returns validated JSON and spends one unit of the daily budget', async () => {
    const s = setup([() => answer({ ok: true })]);
    await expect(s.run()).resolves.toEqual({ ok: true });
    expect(s.store.used).toBe(1);
  });

  it('switches to the fallback model straight away when the main one is rate limited', async () => {
    const s = setup([() => rateLimited(40), () => answer({ ok: true })]);
    await expect(s.run()).resolves.toEqual({ ok: true });
    expect(s.calls).toEqual(['main', 'lite']);
    expect(s.elapsed()).toBe(0);
  });

  it('remembers the cool-down: the next request skips the rate-limited model', async () => {
    const s = setup([() => rateLimited(40), () => answer({ ok: true }), () => answer({ ok: true })]);
    await s.run();
    await s.run();
    expect(s.calls).toEqual(['main', 'lite', 'lite']);
  });

  it('retries overloaded (503) responses with backoff, then falls back', async () => {
    const busy = () => new Response('{}', { status: 503 });
    const s = setup([busy, busy, busy, () => answer({ ok: true })]);
    await expect(s.run()).resolves.toEqual({ ok: true });
    expect(s.calls).toEqual(['main', 'main', 'main', 'lite']);
  });

  it('enforces the per-minute limit instead of hitting Google', async () => {
    const s = setup(Array.from({ length: 3 }, () => () => answer({ ok: true })), { GEMINI_RPM_LIMIT: '2', GEMINI_FALLBACK_MODEL: '', GEMINI_DEADLINE_MS: '120000' });
    await s.run();
    await s.run();
    await s.run(); // third call within the minute waits for the window
    expect(s.calls).toHaveLength(3);
    expect(s.elapsed()).toBeGreaterThanOrEqual(60_000);
  });

  it('gives up rather than wait past the deadline (the caller then falls back to basic rules)', async () => {
    const s = setup(Array.from({ length: 2 }, () => () => answer({ ok: true })), { GEMINI_RPM_LIMIT: '2', GEMINI_FALLBACK_MODEL: '', GEMINI_DEADLINE_MS: '30000' });
    await s.run();
    await s.run();
    await expect(s.run()).rejects.toMatchObject({ code: 'upstream' });
    expect(s.calls).toHaveLength(2);
    expect(s.store.used).toBe(2);
  });

  it('gives the budget unit back and reports clearly when everything is down', async () => {
    const busy = () => new Response('{}', { status: 503 });
    const s = setup(Array.from({ length: 6 }, () => busy));
    await expect(s.run()).rejects.toMatchObject({ code: 'upstream' });
    expect(s.store.used).toBe(0);
  });

  it('rejects answers that do not match the schema', async () => {
    const s = setup([() => answer({ ok: 'yes' })]);
    await expect(s.run()).rejects.toBeInstanceOf(AiError);
  });

  it('stops before calling Google when the daily budget is spent', async () => {
    const s = setup([], { GEMINI_RPD_LIMIT: '1' });
    s.store.used = 1;
    await expect(s.run()).rejects.toMatchObject({ code: 'quota' });
    expect(s.calls).toEqual([]);
  });
});
