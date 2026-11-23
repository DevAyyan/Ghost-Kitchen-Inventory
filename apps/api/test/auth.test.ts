import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { AuthUnavailable, createClerkVerifier, frontendApi } from '../src/auth.js';
import { MemoryStore } from '../src/store.js';
import { fakeGemini, fakeMealDb, fakeOcr, testConfig } from './fakes.js';

const HOST = 'clever-ghost-12.clerk.accounts.dev';
const PK = `pk_test_${Buffer.from(`${HOST}$`).toString('base64')}`;
const ISS = `https://${HOST}`;

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = (k: KeyObject, kid: string) => ({ ...k.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' });

function token(claims: Record<string, unknown>, opts: { kid?: string; key?: KeyObject; alg?: string } = {}) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'k1', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ iss: ISS, sub: 'user_alice', sid: 'sess_1', iat: now, nbf: now - 5, exp: now + 60, ...claims });
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(opts.key ?? privateKey).toString('base64url');
  return `${head}.${body}.${sig}`;
}

/** Clerk's key endpoint, counting calls; `down` makes it fail like a network error. */
function jwks(keys = [jwk(publicKey, 'k1')]) {
  const state = { calls: 0, down: false, keys };
  const fetch = (async () => {
    state.calls++;
    if (state.down) throw new Error('offline');
    return new Response(JSON.stringify({ keys: state.keys }), { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  return { state, fetch };
}

describe('Clerk publishable keys', () => {
  it('reads the frontend API host and rejects anything else', () => {
    expect(frontendApi(PK)).toBe(HOST);
    expect(frontendApi(`pk_live_${Buffer.from('clerk.example.com$').toString('base64')}`)).toBe('clerk.example.com');
    expect(frontendApi('sk_test_abc')).toBeNull();
    expect(frontendApi(`pk_test_${Buffer.from('no-dollar.example.com').toString('base64')}`)).toBeNull();
  });
});

describe('session tokens', () => {
  it('accepts a valid token and returns the person', async () => {
    const v = createClerkVerifier({ publishableKey: PK, fetch: jwks().fetch });
    expect(await v.verify(token({}))).toEqual({ id: 'user_alice', sessionId: 'sess_1' });
  });

  it('rejects expired, early, foreign, unsigned and tampered tokens', async () => {
    const v = createClerkVerifier({ publishableKey: PK, fetch: jwks().fetch });
    const now = Math.floor(Date.now() / 1000);
    await expect(v.verify(token({ exp: now - 60 }))).rejects.toThrow('expired');
    await expect(v.verify(token({ nbf: now + 600 }))).rejects.toThrow('not valid yet');
    await expect(v.verify(token({ iss: 'https://evil.example.com' }))).rejects.toThrow('issuer');
    await expect(v.verify(token({}, { alg: 'none' }))).rejects.toThrow('Unsupported');
    await expect(v.verify(token({}, { key: other.privateKey }))).rejects.toThrow('signature');
    const [h, , s] = token({}).split('.');
    const forged = Buffer.from(JSON.stringify({ iss: ISS, sub: 'user_mallory', exp: now + 60 })).toString('base64url');
    await expect(v.verify(`${h}.${forged}.${s}`)).rejects.toThrow('signature');
    await expect(v.verify('not-a-token')).rejects.toThrow('Malformed');
  });

  it('checks the web origin when one is configured; native tokens have none', async () => {
    const v = createClerkVerifier({ publishableKey: PK, fetch: jwks().fetch, authorizedParties: ['https://kitchen.example.com/'] });
    expect((await v.verify(token({ azp: 'https://kitchen.example.com' }))).id).toBe('user_alice');
    expect((await v.verify(token({}))).id).toBe('user_alice');
    await expect(v.verify(token({ azp: 'https://evil.example.com' }))).rejects.toThrow('origin');
  });

  it('caches the keys, fetches again for a new key, and keeps working when Clerk is unreachable', async () => {
    const k = jwks();
    const v = createClerkVerifier({ publishableKey: PK, fetch: k.fetch });
    await v.verify(token({}));
    await v.verify(token({}));
    expect(k.state.calls).toBe(1);
    // Clerk rotated its key.
    k.state.keys = [jwk(publicKey, 'k1'), jwk(other.publicKey, 'k2')];
    expect((await v.verify(token({}, { kid: 'k2', key: other.privateKey }))).id).toBe('user_alice');
    expect(k.state.calls).toBe(2);
    k.state.down = true;
    expect((await v.verify(token({}))).id).toBe('user_alice');
    await expect(v.verify(token({}, { kid: 'k3' }))).rejects.toThrow('Unknown signing key');
  });

  it("says sign-in can't be checked, not that the session is bad, when Clerk was never reached", async () => {
    const k = jwks();
    k.state.down = true;
    const v = createClerkVerifier({ publishableKey: PK, fetch: k.fetch });
    await expect(v.verify(token({}))).rejects.toBeInstanceOf(AuthUnavailable);
    k.state.down = false;
    expect((await v.verify(token({}))).id).toBe('user_alice');
  });
});

// ---- The API with sign-in on.
let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

async function make(env: Record<string, string> = {}) {
  const store = new MemoryStore();
  app = await buildApp({
    cfg: testConfig({ CLERK_PUBLISHABLE_KEY: PK, ...env }), store,
    gemini: fakeGemini(() => ({})), ocr: fakeOcr([]), mealdb: fakeMealDb([], {}),
    verifier: createClerkVerifier({ publishableKey: PK, fetch: jwks().fetch }),
  });
  return { a: app, store };
}

const as = (user: string) => ({ authorization: `Bearer ${token({ sub: user })}` });
const call = (a: FastifyInstance, url: string, user: string | null, body: unknown = {}, key?: string) =>
  a.inject({ method: 'POST', url, payload: body as object, headers: { ...(user ? as(user) : {}), ...(key ? { 'x-household-key': key } : {}) } });
const item = (id: string, name: string) => ({ id, name, category: 'produce', zone: 'fridge', qty: 1, fraction: 1, priceMinor: 100, currency: 'EUR', purchased: '2026-11-01', expires: '2026-11-08', shelfDays: 7, status: 'active' });

describe('API with sign-in', () => {
  it('gives an account one kitchen, the same on every device, made only once', async () => {
    const { a } = await make();
    const phone = (await call(a, '/v1/households/current', 'user_alice')).json();
    const laptop = (await call(a, '/v1/households/current', 'user_alice')).json();
    expect([phone.made, laptop.made]).toEqual([true, false]);
    expect({ ...laptop, made: true }).toEqual(phone);
    expect(phone).toMatchObject({ name: 'My kitchen', members: 1 });
    expect(phone.key).toBe(phone.householdId);
    await call(a, '/v1/me', 'user_bob', { displayName: 'Bob' });
    expect((await call(a, '/v1/households/current', 'user_bob')).json().name).toBe("Bob's kitchen");
    expect((await call(a, '/v1/households/current', null)).statusCode).toBe(401);
  });

  it('settles two first sign-ins at the same moment on one kitchen', async () => {
    const { a } = await make();
    const [x, y] = await Promise.all([call(a, '/v1/households/current', 'user_alice'), call(a, '/v1/households/current', 'user_alice')]);
    const after = (await call(a, '/v1/households/current', 'user_alice')).json();
    expect([x.json().householdId, y.json().householdId]).toContain(after.householdId);
    expect((await a.inject({ method: 'GET', url: '/v1/households/mine', headers: as('user_alice') })).json().households).toHaveLength(1);
  });

  it('moves the whole account when it joins another kitchen, so its other devices follow', async () => {
    const { a, store } = await make();
    const mine = (await call(a, '/v1/households/current', 'user_alice')).json();
    const family = (await call(a, '/v1/households/current', 'user_sam')).json();
    const { code } = (await call(a, '/v1/households/invite', 'user_sam', {}, family.key)).json();
    await call(a, '/v1/households/join', 'user_alice', { code });

    // Alice's other device still holds her old kitchen: it's refused there now, and /current points it on.
    expect((await call(a, '/v1/households/sync', 'user_alice', { deviceId: 'laptop-bbbb' }, mine.key)).statusCode).toBe(401);
    expect((await call(a, '/v1/households/current', 'user_alice')).json().householdId).toBe(family.householdId);
    expect(await store.getHousehold(mine.householdId)).toBeNull(); // nobody was left in it

    // Leaving takes her back to a kitchen of her own; Sam keeps the family one.
    await call(a, '/v1/households/leave', 'user_alice', {}, family.key);
    const back = (await call(a, '/v1/households/current', 'user_alice')).json();
    expect(back.householdId).not.toBe(family.householdId);
    expect(await store.userRole(family.householdId, 'user_sam')).toBe('owner');
  });

  it('keeps one account in step across its devices: the same food on both, and edits pass over', async () => {
    const { a } = await make();
    // Phone: first sign-in anywhere. The app finds no kitchen and makes one, then uploads its food.
    expect((await a.inject({ method: 'GET', url: '/v1/households/mine', headers: as('user_alice') })).json().households).toEqual([]);
    const hh = (await call(a, '/v1/households', 'user_alice', { name: "Alice's kitchen" })).json();
    await call(a, '/v1/households/sync', 'user_alice', { deviceId: 'phone-aaaa', changes: [{ collection: 'items', id: 'i1', updatedAt: 1, deleted: false, data: item('i1', 'Milk') }] }, hh.key);

    // Laptop: same account signs in, finds the kitchen through the account and pulls the same food.
    const mine = (await a.inject({ method: 'GET', url: '/v1/households/mine', headers: as('user_alice') })).json().households;
    expect(mine.map((h: { id: string }) => h.id)).toEqual([hh.householdId]);
    const first = (await call(a, '/v1/households/sync', 'user_alice', { deviceId: 'laptop-bbbb' }, mine[0].id)).json();
    expect(first.changes.map((c: { id: string }) => c.id)).toEqual(['i1']);

    // An edit on the laptop shows up on the phone's next sync.
    await call(a, '/v1/households/sync', 'user_alice', { deviceId: 'laptop-bbbb', since: first.cursor, changes: [{ collection: 'items', id: 'i1', updatedAt: 2, deleted: false, data: { ...item('i1', 'Milk'), fraction: 0.5 } }] }, mine[0].id);
    const phone = (await call(a, '/v1/households/sync', 'user_alice', { deviceId: 'phone-aaaa', since: 1 }, hh.key)).json();
    expect(phone.changes.find((c: { id: string }) => c.id === 'i1').data.fraction).toBe(0.5);

    // Someone else signing in can't reach it.
    expect((await call(a, '/v1/households/sync', 'user_sam', { deviceId: 'device-cccc' }, hh.key)).statusCode).toBe(401);
  });

  it('tells the app how to sign in, and turns away requests without a session', async () => {
    const { a } = await make({ API_TOKEN: 'ignored-when-signin-is-on' });
    const status = (await a.inject('/v1/status')).json();
    expect(status.auth).toEqual({ provider: 'clerk', publishableKey: PK });
    const anon = await a.inject({ method: 'POST', url: '/v1/tonight', payload: {} });
    expect([anon.statusCode, anon.json().error.code]).toEqual([401, 'signed_out']);
    const bad = await a.inject({ method: 'GET', url: '/v1/me', headers: { authorization: 'Bearer nope' } });
    expect(bad.statusCode).toBe(401);
  });

  it('makes a profile on first use and keeps changes, merging preferences', async () => {
    const { a } = await make();
    const first = (await a.inject({ method: 'GET', url: '/v1/me', headers: as('user_alice') })).json();
    expect(first.profile).toMatchObject({ id: 'user_alice', displayName: 'New ghost', prefs: {} });
    expect(first.profile.avatar.ghost).toBeGreaterThanOrEqual(0);

    await call(a, '/v1/me', 'user_alice', { displayName: 'Alice', avatar: { ghost: 3, colour: 'pumpkin' }, prefs: { largeText: true, diets: ['vegetarian'] } });
    const next = (await call(a, '/v1/me', 'user_alice', { prefs: { soundEffects: false } })).json();
    expect(next.profile).toMatchObject({ displayName: 'Alice', avatar: { ghost: 3, colour: 'pumpkin' }, prefs: { largeText: true, diets: ['vegetarian'], soundEffects: false } });

    expect((await call(a, '/v1/me', 'user_alice', { displayName: '' })).statusCode).toBe(400);
    expect((await call(a, '/v1/me', 'user_alice', { avatar: { ghost: 9, colour: 'pumpkin' } })).statusCode).toBe(400);
  });

  it('runs a household of people: invite, join, who did what, members and roles', async () => {
    const { a } = await make();
    await call(a, '/v1/me', 'user_alice', { displayName: 'Alice' });
    await call(a, '/v1/me', 'user_sam', { displayName: 'Sam' });
    const hh = (await call(a, '/v1/households', 'user_alice', { name: 'Flat 4B' })).json();
    expect(hh.key).toBe(hh.householdId); // a person's key is just the household id

    const { code } = (await call(a, '/v1/households/invite', 'user_alice', {}, hh.key)).json();
    const joined = (await call(a, '/v1/households/join', 'user_sam', { code })).json();
    expect(joined.key).toBe(hh.householdId);

    // Knowing the household id isn't enough: Mallory isn't a member.
    expect((await call(a, '/v1/households/sync', 'user_mallory', { deviceId: 'device-cccc' }, hh.key)).statusCode).toBe(401);

    // Sam bins something; the history says it was Sam, whatever the device claims.
    const event = { id: 'e1', type: 'discarded', name: 'Milk', category: 'dairy', minor: 120, currency: 'EUR', stage: 'spoiled', date: '2026-11-19', by: 'user_alice' };
    await call(a, '/v1/households/sync', 'user_sam', { deviceId: 'device-bbbb', changes: [{ collection: 'events', id: 'e1', updatedAt: 1, deleted: false, data: event }] }, joined.key);
    const pulled = (await call(a, '/v1/households/sync', 'user_alice', { deviceId: 'device-aaaa' }, hh.key)).json();
    expect(pulled.changes[0].data).toMatchObject({ name: 'Milk', by: 'user_sam' });
    expect(pulled.members).toBe(2);

    const members = (await call(a, '/v1/households/members', 'user_sam', {}, hh.key)).json();
    expect(members.people.map((p: { displayName: string; role: string; you: boolean }) => [p.displayName, p.role, p.you])).toEqual([['Alice', 'owner', false], ['Sam', 'member', true]]);
    expect(members.devices).toBe(0);

    // Only the owner removes people or deletes the household.
    expect((await call(a, '/v1/households/remove', 'user_sam', { userId: 'user_alice' }, hh.key)).statusCode).toBe(403);
    expect((await call(a, '/v1/households/delete', 'user_sam', {}, hh.key)).statusCode).toBe(403);
    expect((await call(a, '/v1/households/remove', 'user_alice', { userId: 'user_sam' }, hh.key)).json()).toMatchObject({ remaining: 1 });
    expect((await call(a, '/v1/households/sync', 'user_sam', { deviceId: 'device-bbbb' }, hh.key)).statusCode).toBe(401);

    const mine = (await a.inject({ method: 'GET', url: '/v1/households/mine', headers: as('user_alice') })).json();
    expect(mine.households).toEqual([{ id: hh.householdId, name: 'Flat 4B', role: 'owner' }]);
  });

  it('passes ownership on when the owner leaves, and removes the data when the last person leaves', async () => {
    const { a, store } = await make();
    const hh = (await call(a, '/v1/households', 'user_alice', { name: 'Home' })).json();
    const { code } = (await call(a, '/v1/households/invite', 'user_alice', {}, hh.key)).json();
    await call(a, '/v1/households/join', 'user_sam', { code });
    await call(a, '/v1/households/leave', 'user_alice', {}, hh.key);
    expect(await store.userRole(hh.householdId, 'user_sam')).toBe('owner');
    await call(a, '/v1/households/leave', 'user_sam', {}, hh.key);
    expect(await store.getHousehold(hh.householdId)).toBeNull();
  });

  it('turns a device key from before accounts into a membership, once', async () => {
    const { a, store } = await make();
    // A household made the old way, before sign-in was turned on.
    const id = 'oldhouse';
    await store.createHousehold({ id, name: 'Old flat' }, (await import('node:crypto')).createHash('sha256').update('s3cret').digest('hex'));
    const deviceKey = `${id}.s3cret`;
    // The old key still works for a signed-in device until it is claimed.
    expect((await call(a, '/v1/households/sync', 'user_alice', { deviceId: 'device-aaaa' }, deviceKey)).statusCode).toBe(200);
    const claimed = (await call(a, '/v1/households/claim', 'user_alice', {}, deviceKey)).json();
    expect(claimed).toEqual({ householdId: id, name: 'Old flat', key: id });
    expect(await store.userRole(id, 'user_alice')).toBe('owner');
    // The device key is used up.
    expect((await call(a, '/v1/households/claim', 'user_sam', {}, deviceKey)).statusCode).toBe(401);
    expect((await call(a, '/v1/households/sync', 'user_alice', { deviceId: 'device-aaaa' }, id)).statusCode).toBe(200);
  });

  it('deletes an account: profile and memberships go, a shared household stays for the others', async () => {
    const { a, store } = await make();
    const shared = (await call(a, '/v1/households', 'user_alice', { name: 'Shared' })).json();
    const { code } = (await call(a, '/v1/households/invite', 'user_alice', {}, shared.key)).json();
    await call(a, '/v1/households/join', 'user_sam', { code });
    await call(a, '/v1/households/sync', 'user_alice', { deviceId: 'device-aaaa', changes: [{ collection: 'items', id: 'i1', updatedAt: 1, deleted: false, data: item('i1', 'Spinach') }] }, shared.key);
    const alone = (await call(a, '/v1/households', 'user_alice', { name: 'Just me' })).json();
    // One kitchen per account: making "Just me" moved Alice out of Shared, and Sam took over as owner.
    expect(await store.userRole(shared.householdId, 'user_alice')).toBeNull();

    expect((await call(a, '/v1/me/delete', 'user_alice')).json()).toEqual({ ok: true });
    expect(await store.getProfile('user_alice')).toBeNull();
    expect(await store.getHousehold(alone.householdId)).toBeNull();
    expect(await store.countSyncRecords(shared.householdId)).toBe(1);
    expect(await store.userRole(shared.householdId, 'user_sam')).toBe('owner');
  });
});
