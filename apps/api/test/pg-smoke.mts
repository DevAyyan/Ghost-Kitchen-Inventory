/**
 * Manual check of the Postgres queries behind accounts and households (the unit tests use MemoryStore).
 * Run against a throwaway database: SMOKE_DATABASE_URL=postgresql://… npx tsx test/pg-smoke.mts
 */
import assert from 'node:assert/strict';
import { PgStore } from '../src/store.js';

const url = process.env.SMOKE_DATABASE_URL;
if (!url) throw new Error('Set SMOKE_DATABASE_URL to a throwaway database.');
const s = new PgStore(url, 'UTC');
await s.migrate();
await s.migrate(); // idempotent

await s.putProfile({ id: 'user_a', displayName: 'Alice', avatar: { ghost: 1, colour: 'mint' }, prefs: { largeText: true }, createdAt: '' });
await s.putProfile({ id: 'user_b', displayName: 'Sam', avatar: { ghost: 2, colour: 'moss' }, prefs: {}, createdAt: '' });
assert.equal((await s.getProfile('user_a'))?.displayName, 'Alice');
assert.deepEqual((await s.getProfile('user_a'))?.prefs, { largeText: true });

await s.createHouseholdForUser({ id: 'h1', name: 'Flat' }, 'user_a');
await s.addUserMember('h1', 'user_b', 'member');
await s.addUserMember('h1', 'user_b', 'member'); // no duplicate
await s.addMember('h1', 'devicehash');
assert.equal(await s.memberCount('h1'), 3);
assert.equal(await s.userRole('h1', 'user_a'), 'owner');
assert.deepEqual((await s.listUserMembers('h1')).map((m) => [m.displayName, m.role]), [['Alice', 'owner'], ['Sam', 'member']]);
assert.deepEqual(await s.userHouseholds('user_b'), [{ id: 'h1', name: 'Flat' }]);
assert.equal(await s.removeUserMember('h1', 'user_b'), 2);

await s.deleteProfile('user_a');
assert.equal(await s.userRole('h1', 'user_a'), null);
assert.equal(await s.memberCount('h1'), 1);
await s.deleteHousehold('h1');
await s.deleteProfile('user_b');
await s.close();
console.log('pg smoke ok');
