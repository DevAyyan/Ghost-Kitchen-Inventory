import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SYNC_COLLECTIONS, type Store, type SyncChange } from './store.js';

/**
 * Shared households: a few devices keep one fridge, shopping list and meal plan in step.
 * There are no accounts. Each device holds its own secret key for the household and can read and write its
 * data, so a key is only ever handed out through a short-lived, single-use invite code.
 */

const INVITE_TTL_MS = 10 * 60_000;
/** No 0/O/1/I/L: invite codes get read aloud and typed on a phone. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_RECORDS = 20_000;
const MAX_RECORD_BYTES = 8 * 1024;
/** A device clock running ahead must not be able to win every future conflict. */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const PAGE = 500;

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const error = (code: string, message: string) => ({ error: { code, message } });

const Name = z.string().trim().min(1).max(40);
const Create = z.object({ name: Name });
const Join = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/, 'Invite codes have 8 letters and numbers.') });
const Change = z.object({
  collection: z.enum(SYNC_COLLECTIONS),
  id: z.string().min(1).max(64),
  updatedAt: z.number().int().nonnegative(),
  deleted: z.boolean().default(false),
  data: z.record(z.string(), z.unknown()).nullable(),
});
const Sync = z.object({
  deviceId: z.string().min(8).max(64),
  since: z.number().int().nonnegative().default(0),
  changes: z.array(Change).max(PAGE).default([]),
});

export function registerHouseholdRoutes(app: FastifyInstance, store: Store, now: () => number = Date.now) {
  /** The key is `<household id>.<device secret>`; only a hash of the secret is stored. */
  async function authed(req: FastifyRequest, reply: FastifyReply): Promise<{ id: string; secretHash: string } | null> {
    const raw = String(req.headers['x-household-key'] ?? '');
    const dot = raw.indexOf('.');
    const id = dot > 0 ? raw.slice(0, dot) : '';
    const secretHash = hash(dot > 0 ? raw.slice(dot + 1) : '');
    if (!id || !(await store.hasMember(id, secretHash))) {
      reply.code(401).send(error('household_unauthorized', 'This device is no longer part of the household. Join again with a new invite.'));
      return null;
    }
    return { id, secretHash };
  }

  const newSecret = () => randomBytes(24).toString('base64url');

  app.post('/v1/households', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req) => {
    const { name } = Create.parse(req.body);
    const id = randomBytes(9).toString('base64url');
    const secret = newSecret();
    await store.createHousehold({ id, name }, hash(secret));
    return { householdId: id, name, key: `${id}.${secret}` };
  });

  app.post('/v1/households/invite', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const who = await authed(req, reply);
    if (!who) return reply;
    const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    const expiresAt = new Date(now() + INVITE_TTL_MS);
    await store.createInvite(code, who.id, expiresAt);
    return { code, expiresAt: expiresAt.toISOString() };
  });

  // The invite is the only way to get a key, so guessing codes is the attack: keep this tightly limited.
  app.post('/v1/households/join', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { code } = Join.parse(req.body);
    const id = await store.takeInvite(code);
    const hh = id ? await store.getHousehold(id) : null;
    if (!id || !hh) return reply.code(404).send(error('invite_invalid', 'That invite is wrong or has expired. Ask for a new one.'));
    const secret = newSecret();
    await store.addMember(id, hash(secret));
    return { householdId: id, name: hh.name, key: `${id}.${secret}` };
  });

  app.post('/v1/households/sync', { bodyLimit: 2 * 1024 * 1024, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const who = await authed(req, reply);
    if (!who) return reply;
    const body = Sync.parse(req.body);
    const limit = now() + MAX_CLOCK_SKEW_MS;

    if (body.changes.length > 0) {
      for (const c of body.changes) {
        if (c.data && JSON.stringify(c.data).length > MAX_RECORD_BYTES) {
          return reply.code(413).send(error('too_large', 'One of the items is too large to share.'));
        }
      }
      if ((await store.countSyncRecords(who.id)) + body.changes.length > MAX_RECORDS) {
        return reply.code(413).send(error('household_full', 'This household holds as much data as it can. Clear old history on one device.'));
      }
      const clamped: SyncChange[] = body.changes.map((c) => ({ ...c, updatedAt: Math.min(c.updatedAt, limit), data: c.deleted ? null : c.data }));
      await store.putSyncChanges(who.id, body.deviceId, clamped);
    }

    const rows = await store.getSyncChanges(who.id, body.since, PAGE + 1);
    const page = rows.slice(0, PAGE);
    const hh = await store.getHousehold(who.id);
    return {
      name: hh?.name ?? '',
      members: await store.memberCount(who.id),
      changes: page,
      cursor: page.length ? page[page.length - 1]!.seq : body.since,
      more: rows.length > PAGE,
      serverTime: now(),
    };
  });

  /** This device stops sharing. The last one out removes the household's data. */
  app.post('/v1/households/leave', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const who = await authed(req, reply);
    if (!who) return reply;
    const left = await store.removeMember(who.id, who.secretHash);
    if (left === 0) await store.deleteHousehold(who.id);
    return { ok: true, remaining: left };
  });

  /** Removes the household and its data for everyone. */
  app.post('/v1/households/delete', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const who = await authed(req, reply);
    if (!who) return reply;
    await store.deleteHousehold(who.id);
    return { ok: true };
  });
}
