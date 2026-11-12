import type { z } from 'zod';
import type { Config } from '../src/config.js';
import { loadConfig } from '../src/config.js';
import { AiError, type Gemini } from '../src/gemini.js';
import type { MealDb, MealDetail } from '../src/mealdb.js';
import type { Ocr, OcrLine } from '../src/ocr.js';

export const testConfig = (over: Record<string, string> = {}): Config =>
  loadConfig({ DATABASE_URL: 'memory', LOG_LEVEL: 'silent', ...over });

/** Gemini stand-in: `handler` returns whatever the model would answer, or throws AiError. */
export function fakeGemini(handler: (req: { system: string; prompt: string }) => unknown, enabled = true) {
  const calls: { system: string; prompt: string }[] = [];
  const g: Gemini & { calls: typeof calls } = {
    enabled,
    model: 'fake-model',
    calls,
    async generateJson<S extends z.ZodType>(req: { system: string; prompt: string; schema: S }) {
      if (!enabled) throw new AiError('disabled', 'off');
      calls.push({ system: req.system, prompt: req.prompt });
      return req.schema.parse(handler(req)) as z.infer<S>;
    },
  };
  return g;
}

export function fakeOcr(lines: OcrLine[], opts: { fail?: 'bad_image' | 'unreachable' } = {}): Ocr {
  return {
    async read() {
      if (opts.fail) {
        const e = new Error('x') as Error & { code: string };
        e.code = opts.fail;
        throw e;
      }
      return { lines, text: lines.map((l) => l.text).join('\n') };
    },
    async ping() { return true; },
  };
}

export function fakeMealDb(meals: MealDetail[], byIngredient: Record<string, string[]>, names?: string[]): MealDb {
  return {
    async ingredientNames() { return names ?? ['Chicken', 'Spinach', 'Milk', 'Garlic', 'Butter', 'Peanut Butter', 'Eggs', 'Bacon']; },
    async byIngredient(n) { return (byIngredient[n] ?? []).map((id) => ({ id, name: id })); },
    async detail(id) { return meals.find((m) => m.id === id) ?? null; },
  };
}

export const meal = (id: string, title: string, ingredients: string[], over: Partial<MealDetail> = {}): MealDetail => ({
  id, title, category: 'Misc', area: 'Test', tags: [], thumb: `https://img/${id}.jpg`, youtube: null,
  steps: ['Cook it.'], ingredients: ingredients.map((name) => ({ name, measure: '1' })),
  sourceUrl: `https://www.themealdb.com/meal/${id}`, ...over,
});

/** A minimal JPEG header, enough for the magic-byte check. */
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

export function multipart(fields: Record<string, string>, file?: { name: string; data: Buffer }) {
  const boundary = '----gktest';
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  if (file) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    parts.push(file.data, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
