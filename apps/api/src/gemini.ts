import type { z } from 'zod';
import type { Config } from './config.js';
import { geminiSchema } from './schemas.js';
import type { Store } from './store.js';
import { fixMojibakeDeep } from './text.js';

export type AiFailure = 'disabled' | 'quota' | 'upstream' | 'invalid';

export class AiError extends Error {
  constructor(public code: AiFailure, message: string) {
    super(message);
    this.name = 'AiError';
  }
}

/** An image sent to the model alongside the prompt (base64, no data: prefix). */
export interface GeminiImage { mimeType: string; data: string }

export interface Gemini {
  readonly enabled: boolean;
  readonly model: string;
  generateJson<S extends z.ZodType>(req: { system: string; prompt: string; schema: S; image?: GeminiImage }): Promise<z.infer<S>>;
}

type Fetch = typeof fetch;
type Clock = { now(): number; sleep(ms: number): Promise<void> };
const realClock: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

/** Reads Google's RetryInfo ("17s") from an error body, in ms. */
export function retryDelayMs(body: unknown): number | null {
  const details = (body as { error?: { details?: { retryDelay?: string }[] } })?.error?.details ?? [];
  for (const d of details) {
    const m = /^(\d+(?:\.\d+)?)s$/.exec(d.retryDelay ?? '');
    if (m) return Math.ceil(Number(m[1]) * 1000);
  }
  return null;
}

/** Sliding one-minute window per model, so we stay under free-tier requests-per-minute limits. */
class MinuteWindow {
  private stamps: number[] = [];
  constructor(private limit: number, private clock: Clock) {}
  /** How long to wait before a request may start (0 = now). */
  waitMs() {
    const now = this.clock.now();
    this.stamps = this.stamps.filter((t) => now - t < 60_000);
    return this.stamps.length < this.limit ? 0 : 60_000 - (now - this.stamps[0]!) + 50;
  }
  take() { this.stamps.push(this.clock.now()); }
}

/**
 * Minimal Gemini REST client (no SDK). The API key travels in a header, never a URL, and is never logged.
 * - One daily budget unit per logical request (given back if Google never answered).
 * - Per-model requests-per-minute window, honouring Google's retry delay.
 * - Falls back to a second model when the first is rate-limited or overloaded.
 * - Everything finishes within GEMINI_DEADLINE_MS so a user is never left waiting indefinitely.
 */
export function createGemini(cfg: Config, store: Store, doFetch: Fetch = fetch, clock: Clock = realClock): Gemini {
  const key = cfg.GEMINI_API_KEY;
  const models = [
    { name: cfg.GEMINI_MODEL, window: new MinuteWindow(cfg.GEMINI_RPM_LIMIT, clock) },
    ...(cfg.GEMINI_FALLBACK_MODEL && cfg.GEMINI_FALLBACK_MODEL !== cfg.GEMINI_MODEL
      ? [{ name: cfg.GEMINI_FALLBACK_MODEL, window: new MinuteWindow(cfg.GEMINI_FALLBACK_RPM_LIMIT, clock) }]
      : []),
  ];
  /** model -> time before which we don't bother calling it (after a 429). */
  const coolUntil = new Map<string, number>();

  return {
    enabled: !!key,
    model: cfg.GEMINI_MODEL,
    async generateJson({ system, prompt, schema, image }) {
      if (!key) throw new AiError('disabled', 'Gemini is not configured on this server.');
      if (!(await store.reserveAi(cfg.GEMINI_RPD_LIMIT))) throw new AiError('quota', "Today's AI budget is used up.");

      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [...(image ? [{ inlineData: { mimeType: image.mimeType, data: image.data } }] : []), { text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseJsonSchema: geminiSchema(schema),
          thinkingConfig: { thinkingLevel: 'low' },
        },
      });
      const deadline = clock.now() + cfg.GEMINI_DEADLINE_MS;
      const left = () => deadline - clock.now();
      let reachedModel = false;
      let rateLimited = false;

      for (const [i, model] of models.entries()) {
        const isLast = i === models.length - 1;
        for (let attempt = 0; attempt < 3; attempt++) {
          // Wait out a cool-down or a full minute window, but only if it fits the deadline.
          const wait = Math.max(model.window.waitMs(), (coolUntil.get(model.name) ?? 0) - clock.now());
          if (wait > 0) {
            if (!isLast || wait >= left() - 2000) break;
            await clock.sleep(wait);
          }
          if (left() < 2000) break;
          model.window.take();

          let res: Response;
          try {
            res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.name)}:generateContent`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
              body,
              signal: AbortSignal.timeout(Math.min(cfg.GEMINI_TIMEOUT_MS, left())),
            });
          } catch {
            continue; // timeout or network blip
          }

          if (res.status === 429) {
            rateLimited = true;
            const delay = retryDelayMs(await res.json().catch(() => null)) ?? 30_000;
            coolUntil.set(model.name, clock.now() + delay);
            if (!isLast) break; // go straight to the fallback model
            continue;           // last model: the loop above waits the delay if it fits
          }
          if (res.status >= 500) {
            if (attempt < 2 && left() > 4000) await clock.sleep(1500 * 2 ** attempt);
            continue;
          }
          if (!res.ok) {
            await store.releaseAi();
            throw new AiError('upstream', `Gemini rejected the request (HTTP ${res.status}).`);
          }

          reachedModel = true;
          const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
          const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
          let json: unknown;
          try { json = fixMojibakeDeep(JSON.parse(text ?? '')); } catch { throw new AiError('invalid', 'Gemini returned malformed JSON.'); }
          const parsed = schema.safeParse(json);
          if (!parsed.success) throw new AiError('invalid', 'Gemini returned data in an unexpected shape.');
          return parsed.data;
        }
      }
      if (!reachedModel) await store.releaseAi();
      throw new AiError('upstream', rateLimited ? 'Gemini is rate limiting requests right now.' : 'Gemini is unavailable right now.');
    },
  };
}
