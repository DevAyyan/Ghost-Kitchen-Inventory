import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store.js';
import { fakeGemini, fakeMealDb, fakeOcr, testConfig } from './fakes.js';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

async function make(store = new MemoryStore()) {
  app = await buildApp({ cfg: testConfig(), store, gemini: fakeGemini(() => ({})), ocr: fakeOcr([]), mealdb: fakeMealDb([], {}) });
  return { a: app, store };
}

const post = (a: FastifyInstance, url: string, body: unknown, key?: string) =>
  a.inject({ method: 'POST', url, payload: body as object, headers: key ? { 'x-household-key': key } : {} });

const item = (id: string, name: string) => ({ id, name, category: 'produce', zone: 'fridge', qty: 1, fraction: 1, priceMinor: 100, currency: 'EUR', purchased: '2026-11-01', expires: '2026-11-08', shelfDays: 7, status: 'active' });

describe('shared households', () => {
  it('creates, invites, joins and syncs between two devices', async () => {
    const { a } = await make();
    const created = (await post(a, '/v1/households', { name: 'Flat 4B' })).json();
    expect(created.key).toMatch(/^[\w-]+\.[\w-]+$/);

    const invite = (await post(a, '/v1/households/invite', {}, created.key)).json();
    expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    const joined = (await post(a, '/v1/households/join', { code: invite.code })).json();
    expect(joined.householdId).toBe(created.householdId);
    expect(joined.key).not.toBe(created.key); // every device has its own key

    // Invites are single use.
    expect((await post(a, '/v1/households/join', { code: invite.code })).statusCode).toBe(404);

    const push = await post(a, '/v1/households/sync', { deviceId: 'device-aaaa', since: 0, changes: [{ collection: 'items', id: 'i1', updatedAt: 1000, deleted: false, data: item('i1', 'Spinach') }] }, created.key);
    expect(push.statusCode).toBe(200);
    const pull = (await post(a, '/v1/households/sync', { deviceId: 'device-bbbb', since: 0, changes: [] }, joined.key)).json();
    expect(pull.members).toBe(2);
    expect(pull.changes).toHaveLength(1);
    expect(pull.changes[0]).toMatchObject({ collection: 'items', id: 'i1', data: { name: 'Spinach' } });

    // Nothing new after the cursor.
    const again = (await post(a, '/v1/households/sync', { deviceId: 'device-bbbb', since: pull.cursor, changes: [] }, joined.key)).json();
    expect(again.changes).toHaveLength(0);
  });

  it('keeps the newest write and passes deletions on', async () => {
    const { a } = await make();
    const { key } = (await post(a, '/v1/households', { name: 'Home' })).json();
    const sync = (changes: unknown[], since = 0) => post(a, '/v1/households/sync', { deviceId: 'device-aaaa', since, changes }, key).then((r) => r.json());
    await sync([{ collection: 'items', id: 'i1', updatedAt: 2000, deleted: false, data: item('i1', 'New name') }]);
    await sync([{ collection: 'items', id: 'i1', updatedAt: 1000, deleted: false, data: item('i1', 'Old name') }]);
    let all = await sync([]);
    expect(all.changes[0].data.name).toBe('New name');
    await sync([{ collection: 'items', id: 'i1', updatedAt: 3000, deleted: true, data: null }]);
    all = await sync([]);
    expect(all.changes[0]).toMatchObject({ id: 'i1', deleted: true, data: null });
  });

  it("doesn't let a fast clock win every future conflict", async () => {
    const { a } = await make();
    const { key } = (await post(a, '/v1/households', { name: 'Home' })).json();
    await post(a, '/v1/households/sync', { deviceId: 'device-aaaa', changes: [{ collection: 'items', id: 'i1', updatedAt: Date.now() + 365 * 86_400_000, deleted: false, data: item('i1', 'Future') }] }, key);
    const res = (await post(a, '/v1/households/sync', { deviceId: 'device-aaaa', changes: [] }, key)).json();
    expect(res.changes[0].updatedAt).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
  });

  it('rejects wrong keys, bad codes and oversized records', async () => {
    const { a } = await make();
    const { key, householdId } = (await post(a, '/v1/households', { name: 'Home' })).json();
    expect((await post(a, '/v1/households/sync', { deviceId: 'device-aaaa' }, `${householdId}.wrong`)).statusCode).toBe(401);
    expect((await post(a, '/v1/households/sync', { deviceId: 'device-aaaa' })).statusCode).toBe(401);
    expect((await post(a, '/v1/households/join', { code: 'ABCDEFGH' })).statusCode).toBe(404);
    expect((await post(a, '/v1/households/join', { code: 'abc' })).statusCode).toBe(400);
    const big = { ...item('i1', 'x'), note: 'x'.repeat(9000) };
    expect((await post(a, '/v1/households/sync', { deviceId: 'device-aaaa', changes: [{ collection: 'items', id: 'i1', updatedAt: 1, deleted: false, data: big }] }, key)).statusCode).toBe(413);
    expect((await post(a, '/v1/households/sync', { deviceId: 'device-aaaa', changes: [{ collection: 'settings', id: 'x', updatedAt: 1, data: {} }] }, key)).statusCode).toBe(400);
  });

  it('removes a leaving device, and the data once the last one leaves', async () => {
    const { a, store } = await make();
    const first = (await post(a, '/v1/households', { name: 'Home' })).json();
    const { code } = (await post(a, '/v1/households/invite', {}, first.key)).json();
    const second = (await post(a, '/v1/households/join', { code })).json();
    await post(a, '/v1/households/sync', { deviceId: 'device-aaaa', changes: [{ collection: 'shopping', id: 's1', updatedAt: 1, deleted: false, data: { id: 's1', name: 'Milk' } }] }, first.key);

    expect((await post(a, '/v1/households/leave', {}, second.key)).json()).toMatchObject({ remaining: 1 });
    expect((await post(a, '/v1/households/sync', { deviceId: 'device-bbbb' }, second.key)).statusCode).toBe(401);
    expect(await store.countSyncRecords(first.householdId)).toBe(1);

    await post(a, '/v1/households/leave', {}, first.key);
    expect(await store.getHousehold(first.householdId)).toBeNull();
    expect(await store.countSyncRecords(first.householdId)).toBe(0);
  });
});
