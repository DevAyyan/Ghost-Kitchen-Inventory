import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store.js';
import { templateTonight } from '../src/tonight.js';
import { fakeGemini, fakeMealDb, fakeOcr, JPEG, multipart, testConfig } from './fakes.js';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

async function make(handler: (r: { system: string; prompt: string }) => unknown, enabled = true) {
  app = await buildApp({
    cfg: testConfig(), store: new MemoryStore(), gemini: fakeGemini(handler, enabled),
    ocr: fakeOcr([]), mealdb: fakeMealDb([], {}),
  });
  return app;
}

const seen = {
  items: [
    { name: 'Milk', quantity: 1, unit: 'pcs', category: 'dairy', certainty: 0.9, expires: '2026-12-01' },
    { name: 'milk', quantity: 1, unit: 'pcs', category: 'dairy', certainty: 0.6, expires: '2026-02-31' },
    { name: 'Tomatoes', quantity: 4, unit: 'pcs', category: 'produce', certainty: 0.8, expires: null },
  ],
};

describe('POST /v1/items/scan', () => {
  it('identifies the item in the photo and merges duplicates', async () => {
    const a = await make(() => seen);
    const { payload, headers } = multipart({}, { name: 'f.jpg', data: JPEG });
    const res = await a.inject({ method: 'POST', url: '/v1/items/scan', payload, headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.lines).toHaveLength(2);
    expect(body.lines[0]).toMatchObject({ name: 'Milk', quantity: 2, confidence: 0.6, expires: '2026-12-01' });
    expect(body.lines[1].expires).toBeNull(); // not printed on the pack
  });

  it('says so when nothing is seen', async () => {
    const a = await make(() => ({ items: [] }));
    const { payload, headers } = multipart({}, { name: 'f.jpg', data: JPEG });
    const res = await a.inject({ method: 'POST', url: '/v1/items/scan', payload, headers });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('nothing_seen');
  });

  it('needs AI, and rejects non-images', async () => {
    const off = await make(() => seen, false);
    const ok = multipart({}, { name: 'f.jpg', data: JPEG });
    expect((await off.inject({ method: 'POST', url: '/v1/items/scan', payload: ok.payload, headers: ok.headers })).statusCode).toBe(503);
    const bad = multipart({}, { name: 'f.jpg', data: Buffer.from('nope') });
    expect((await off.inject({ method: 'POST', url: '/v1/items/scan', payload: bad.payload, headers: bad.headers })).statusCode).toBe(415);
  });
});

describe('POST /v1/tonight', () => {
  const items = [{ name: 'Spinach', daysLeft: 1 }, { name: 'Chicken breast', daysLeft: -1, highRisk: true }, { name: 'Rice', daysLeft: 0 }];

  it('uses the model idea and drops names that were not in the list', async () => {
    const a = await make(() => ({ title: 'Spinach rice', pitch: 'Fry it all.', uses: ['Spinach', 'Rice', 'Truffle'] }));
    const res = await a.inject({ method: 'POST', url: '/v1/tonight', payload: { items } });
    expect(res.json()).toMatchObject({ source: 'gemini', title: 'Spinach rice', uses: ['Spinach', 'Rice'] });
  });

  it('falls back to a plain nudge without AI, and never names spoiled high-risk food', async () => {
    const a = await make(() => ({}), false);
    const res = await a.inject({ method: 'POST', url: '/v1/tonight', payload: { items } });
    const body = res.json();
    expect(body.source).toBe('template');
    expect(body.uses).toEqual(['Rice', 'Spinach']);
    expect(body.title).not.toContain('Chicken');
  });

  it('validates input', async () => {
    const a = await make(() => ({}));
    expect((await a.inject({ method: 'POST', url: '/v1/tonight', payload: { items: [] } })).statusCode).toBe(400);
  });

  it('template handles a single item', () => {
    expect(templateTonight({ items: [{ name: 'Milk', daysLeft: 0, highRisk: false }], diets: [], useAi: true }).title).toBe('Cook with Milk');
  });
});

describe('POST /v1/voice/parse', () => {
  const items = [{ id: 'm', name: 'Milk', unit: 'l', left: 1 }, { id: 's', name: 'Spinach', unit: 'g', left: 200 }];

  it('keeps only listed ids, once each, and caps amounts at what is left', async () => {
    const a = await make(() => ({ actions: [
      { itemId: 'm', kind: 'used', amount: 5 }, { itemId: 'm', kind: 'binned', amount: null },
      { itemId: 'ghost', kind: 'used', amount: 1 }, { itemId: 's', kind: 'binned', amount: null },
    ] }));
    const res = await a.inject({ method: 'POST', url: '/v1/voice/parse', payload: { text: 'had loads of milk and the greens were slimy', items } });
    expect(res.json()).toEqual({ source: 'gemini', actions: [{ itemId: 'm', kind: 'used', amount: 1 }, { itemId: 's', kind: 'binned', amount: null }] });
  });

  it('answers with nothing when AI is off, and validates input', async () => {
    const off = await make(() => ({}), false);
    expect((await off.inject({ method: 'POST', url: '/v1/voice/parse', payload: { text: 'milk', items } })).json()).toEqual({ actions: [], source: 'none' });
    expect((await off.inject({ method: 'POST', url: '/v1/voice/parse', payload: { text: '', items } })).statusCode).toBe(400);
  });
});
