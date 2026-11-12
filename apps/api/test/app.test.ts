import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, sniffImage } from '../src/app.js';
import { MemoryStore } from '../src/store.js';
import { fakeGemini, fakeMealDb, fakeOcr, JPEG, multipart, testConfig } from './fakes.js';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

const lines = [{ text: 'MILK 2.50', confidence: 0.9 }];
const extraction = {
  store: 'Shop', date: null, subtotal: null, tax: null, total: null,
  currency: { code: 'USD', symbol: '$', confidence: 0.95, evidence: ['US'] },
  items: [{ sourceLine: 0, raw: 'MILK 2.50', name: 'Milk', quantity: 1, unit: 'pcs', price: 2.5, category: 'dairy', isFood: true, certainty: 0.9 }],
};

async function make(env: Record<string, string> = {}, over: { fetch?: typeof fetch; gemini?: ReturnType<typeof fakeGemini> } = {}) {
  app = await buildApp({
    cfg: testConfig(env), store: new MemoryStore(), gemini: over.gemini ?? fakeGemini(() => extraction),
    ocr: fakeOcr(lines), mealdb: fakeMealDb([], {}), fetch: over.fetch,
  });
  return app;
}

describe('image sniffing', () => {
  it('accepts JPEG, PNG and WebP and rejects everything else', () => {
    expect(sniffImage(JPEG)).toBe('image/jpeg');
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImage(Buffer.from('<?php echo 1; ?>'))).toBeNull();
  });
});

describe('API', () => {
  it('reports health and status without leaking secrets', async () => {
    const a = await make({ GEMINI_API_KEY: 'super-secret-key' });
    expect((await a.inject('/health')).statusCode).toBe(200);
    const res = await a.inject('/v1/status');
    expect(res.json()).toMatchObject({ ok: true, ai: { enabled: true, model: 'fake-model', usedToday: 0 }, recipes: { keyType: 'test' } });
    expect(res.body).not.toContain('super-secret-key');
  });

  it('requires the bearer token when one is configured', async () => {
    const a = await make({ API_TOKEN: 'letmein' });
    expect((await a.inject('/v1/status')).statusCode).toBe(401);
    expect((await a.inject({ url: '/v1/status', headers: { authorization: 'Bearer wrong!!' } })).statusCode).toBe(401);
    expect((await a.inject({ url: '/v1/status', headers: { authorization: 'Bearer letmein' } })).statusCode).toBe(200);
    expect((await a.inject('/health')).statusCode).toBe(200); // health stays open for the container check
  });

  it('scans a receipt photo end to end', async () => {
    const a = await make();
    const { payload, headers } = multipart({ useAi: 'true' }, { name: 'r.jpg', data: JPEG });
    const res = await a.inject({ method: 'POST', url: '/v1/receipts/scan', payload, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ source: 'gemini', lines: [{ name: 'Milk', price: 2.5 }], currency: { code: 'USD' } });
  });

  it('rejects non-images, missing files and oversized uploads', async () => {
    const a = await make({ MAX_UPLOAD_MB: '0.0001' });
    const text = multipart({}, { name: 'x.jpg', data: Buffer.from('<?php echo 1; ?>') });
    expect((await a.inject({ method: 'POST', url: '/v1/receipts/scan', payload: text.payload, headers: text.headers })).statusCode).toBe(415);
    const none = multipart({ useAi: 'true' });
    expect((await a.inject({ method: 'POST', url: '/v1/receipts/scan', payload: none.payload, headers: none.headers })).statusCode).toBe(400);
    const big = multipart({}, { name: 'big.jpg', data: Buffer.concat([JPEG, Buffer.alloc(5000)]) });
    expect((await a.inject({ method: 'POST', url: '/v1/receipts/scan', payload: big.payload, headers: big.headers })).statusCode).toBe(413);
  });

  it('looks up product info by the names the client sent, and validates input', async () => {
    const gem = fakeGemini((req) => {
      const names = JSON.parse(req.prompt.slice(req.prompt.indexOf('['))) as string[];
      return { products: names.map((n) => ({ input: n, name: n, category: 'dairy', homeZone: 'fridge', shelfLifeDays: { pantry: null, fridge: 7, freezer: 90 }, highRisk: true, multiUse: true, tags: ['dairy'], tip: '' })) };
    });
    const a = await make({}, { gemini: gem });
    const res = await a.inject({ method: 'POST', url: '/v1/products/info', payload: { names: ['Whole Milk'] } });
    expect(res.json().products['Whole Milk']).toMatchObject({ category: 'dairy', shelfLifeDays: { fridge: 7 } });
    expect((await a.inject({ method: 'POST', url: '/v1/products/info', payload: { names: [] } })).statusCode).toBe(400);
  });

  it('serves exchange rates and falls back to the last snapshot when the provider fails', async () => {
    let fail = false;
    const f = (async () => {
      if (fail) throw new Error('down');
      return new Response(JSON.stringify([{ date: '2026-11-11', base: 'EUR', quote: 'USD', rate: 1.1 }, { date: '2026-11-11', base: 'EUR', quote: 'PKR', rate: 310 }]));
    }) as typeof fetch;
    const a = await make({}, { fetch: f });
    const fresh = (await a.inject('/v1/rates?base=eur')).json();
    expect(fresh).toMatchObject({ base: 'EUR', date: '2026-11-11', stale: false, rates: { EUR: 1, USD: 1.1, PKR: 310 } });
    fail = true;
    expect((await a.inject('/v1/rates?base=EUR')).json().rates.PKR).toBe(310); // served from memory
    expect((await a.inject('/v1/rates?base=GBP')).statusCode).toBe(502);        // nothing cached for GBP
    expect((await a.inject('/v1/rates?base=EURO')).statusCode).toBe(400);
  });

  it('serves the web app, its deep links, and refuses path tricks', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gkweb-'));
    writeFileSync(join(dir, 'index.html'), '<p>home</p>');
    writeFileSync(join(dir, 'recipes.html'), '<p>recipes</p>');
    writeFileSync(join(dir, '+not-found.html'), '<p>missing</p>');
    mkdirSync(join(dir, '_expo'));
    writeFileSync(join(dir, '_expo', 'app.js'), 'console.log(1)');
    const a = await make({ WEB_DIR: dir });
    expect((await a.inject('/')).body).toContain('home');
    expect((await a.inject('/recipes')).body).toContain('recipes');
    expect((await a.inject('/recipes?summon=1')).body).toContain('recipes');
    expect((await a.inject('/_expo/app.js')).statusCode).toBe(200);
    const missing = await a.inject('/nope');
    expect([missing.statusCode, missing.body]).toEqual([404, '<p>missing</p>']);
    expect((await a.inject('/..%2f..%2fetc%2fpasswd')).statusCode).toBe(404);
    expect((await a.inject('/v1/nope')).json().error.code).toBe('not_found');
  });

  it('rate limits the expensive endpoint', async () => {
    const a = await make();
    const { payload, headers } = multipart({}, { name: 'r.jpg', data: JPEG });
    const codes: number[] = [];
    for (let i = 0; i < 14; i++) codes.push((await a.inject({ method: 'POST', url: '/v1/receipts/scan', payload, headers })).statusCode);
    expect(codes.slice(0, 12).every((c) => c === 200)).toBe(true);
    expect(codes.slice(12)).toEqual([429, 429]);
  });
});
