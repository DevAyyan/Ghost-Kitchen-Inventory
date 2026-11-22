import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ensureProfile } from './profile.js';
import { SYNC_COLLECTIONS, type Role, type Store, type SyncChange } from './store.js';

/**
 * Shared households: a few people keep one fridge, shopping list and meal plan in step.
 *
 * With sign-in on (Clerk), a household is made of people: the key a device holds is just the household id,
 * and every request is checked against the signed-in person's membership. Without sign-in (or for a device
 * from before accounts) each device holds its own secret key, handed out only through a short-lived,
 * single-use invite code. A signed-in device with an old key turns it into a membership with /claim.
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
const Remove = z.object({ userId: z.string().regex(/^user_[A-Za-z0-9]+$/) });
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

/** Who is asking: a person (with their role) or, for older devices, a device key. */
type Who = { id: string; userId: string; role: Role } | { id: string; secretHash: string; userId?: undefined };

const Wait = z.object({ deviceId: z.string().min(8).max(64), since: z.number().int().nonnegative().default(0) });
/** Open waits per kitchen, so one household can't hold the server's connections. */
const MAX_WAITERS = 100;

export function registerHouseholdRoutes(app: FastifyInstance, store: Store, now: () => number = Date.now, opts: { waitMs?: number; pollMs?: number } = {}) {
  const waitMs = opts.waitMs ?? 25_000;
  const pollMs = opts.pollMs ?? 1_500;
  /**
   * Devices waiting to hear that their kitchen changed: kitchen id -> callbacks taking the device that
   * made the change. One API process, so this sees every device. An empty device id wakes everyone
   * (membership changes, which their next sync needs to see).
   */
  const waiting = new Map<string, Set<(fromDevice: string) => void>>();
  const notify = (id: string, fromDevice = '') => { for (const wake of [...(waiting.get(id) ?? [])]) wake(fromDevice); };

  /**
   * A person leaves one household. The owner's role passes to the longest-standing member; the last one
   * out removes the data. Returns how many members are left.
   */
  async function leaveAsUser(id: string, userId: string): Promise<number> {
    const role = await store.userRole(id, userId);
    if (!role) return store.memberCount(id);
    const left = await store.removeUserMember(id, userId);
    if (role === 'owner') {
      const next = (await store.listUserMembers(id))[0];
      if (next) { await store.removeUserMember(id, next.userId); await store.addUserMember(id, next.userId, 'owner'); }
    }
    if (left === 0) await store.deleteHousehold(id);
    notify(id);
    return left;
  }

  /**
   * An account is in exactly one kitchen, so every device signed in with it shows the same food. Joining,
   * creating or claiming one takes the account out of any other. Its devices notice on their next sync
   * (they're refused there) and follow it to the new one.
   */
  async function leaveOthers(userId: string, keepId: string) {
    for (const h of await store.userHouseholds(userId)) if (h.id !== keepId) await leaveAsUser(h.id, userId);
  }

  /** The key is `<household id>` for a signed-in person, or `<household id>.<device secret>` for a device. */
  async function authed(req: FastifyRequest, reply: FastifyReply): Promise<Who | null> {
    const raw = String(req.headers['x-household-key'] ?? '');
    const dot = raw.indexOf('.');
    const id = dot > 0 ? raw.slice(0, dot) : raw;
    if (id && req.user) {
      const role = await store.userRole(id, req.user.id);
      if (role) return { id, userId: req.user.id, role };
    }
    if (id && dot > 0) {
      const secretHash = hash(raw.slice(dot + 1));
      if (await store.hasMember(id, secretHash)) return { id, secretHash };
    }
    reply.code(401).send(error('household_unauthorized', 'You are no longer part of this household. Join again with a new invite.'));
    return null;
  }

  const newSecret = () => randomBytes(24).toString('base64url');
  const reply = (id: string, name: string, key: string) => ({ householdId: id, name, key });

  app.post('/v1/households', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req) => {
    const { name } = Create.parse(req.body);
    const id = randomBytes(9).toString('base64url');
    if (req.user) {
      await ensureProfile(store, req.user.id);
      await store.createHouseholdForUser({ id, name }, req.user.id);
      await leaveOthers(req.user.id, id);
      return reply(id, name, id);
    }
    const secret = newSecret();
    await store.createHousehold({ id, name }, hash(secret));
    return reply(id, name, `${id}.${secret}`);
  });

  /**
   * The signed-in account's kitchen, made if it has none. Every device signed in with the account asks
   * this, so they all use the same one. Two devices asking at the same moment could each make one; both
   * then keep the same one (the lowest id) and drop the other, so they still end up together.
   */
  app.post('/v1/households/current', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, res) => {
    if (!req.user) return res.code(401).send(error('signed_out', 'Sign in first.'));
    const profile = await ensureProfile(store, req.user.id);
    let list = await store.userHouseholds(req.user.id);
    let made = false;
    if (list.length === 0) {
      const name = profile.displayName && profile.displayName !== 'New ghost' ? `${profile.displayName}'s kitchen`.slice(0, 40) : 'My kitchen';
      await store.createHouseholdForUser({ id: randomBytes(9).toString('base64url'), name }, req.user.id);
      list = await store.userHouseholds(req.user.id);
      made = true;
    }
    // Accounts from before this rule can be in several: the most recent one is where they meant to be.
    // Ones made in a race are tied on purpose: the lowest id wins on every device.
    const keep = made ? [...list].sort((a, b) => a.id.localeCompare(b.id))[0]! : list[list.length - 1]!;
    await leaveOthers(req.user.id, keep.id);
    // `made`: the account had no kitchen. A device arriving from an old one then brings its food along.
    return { ...reply(keep.id, keep.name, keep.id), members: await store.memberCount(keep.id), made };
  });

  /** The signed-in person's households (the app uses the first; joining another means leaving this one). */
  app.get('/v1/households/mine', async (req, res) => {
    if (!req.user) return res.code(401).send(error('signed_out', 'Sign in first.'));
    const list = await store.userHouseholds(req.user.id);
    return { households: await Promise.all(list.map(async (h) => ({ ...h, role: await store.userRole(h.id, req.user!.id) }))) };
  });

  /**
   * A signed-in device that shared through a device key (before accounts) swaps it for a membership. The
   * first person to do so owns the household. The device key stops working, so it can't be reused.
   */
  app.post('/v1/households/claim', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, res) => {
    if (!req.user) return res.code(401).send(error('signed_out', 'Sign in first.'));
    const raw = String(req.headers['x-household-key'] ?? '');
    const dot = raw.indexOf('.');
    const id = dot > 0 ? raw.slice(0, dot) : '';
    const secretHash = hash(dot > 0 ? raw.slice(dot + 1) : '');
    const hh = id ? await store.getHousehold(id) : null;
    if (!hh || !(await store.hasMember(id, secretHash))) {
      return res.code(401).send(error('household_unauthorized', 'This device is no longer part of the household. Join again with a new invite.'));
    }
    await ensureProfile(store, req.user.id);
    const owners = (await store.listUserMembers(id)).filter((m) => m.role === 'owner').length;
    await store.addUserMember(id, req.user.id, owners ? 'member' : 'owner');
    await store.removeMember(id, secretHash);
    await leaveOthers(req.user.id, id);
    return reply(id, hh.name, id);
  });

  app.post('/v1/households/invite', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, res) => {
    const who = await authed(req, res);
    if (!who) return res;
    const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    const expiresAt = new Date(now() + INVITE_TTL_MS);
    await store.createInvite(code, who.id, expiresAt);
    return { code, expiresAt: expiresAt.toISOString() };
  });

  // The invite is the only way in, so guessing codes is the attack: keep this tightly limited.
  app.post('/v1/households/join', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, res) => {
    const { code } = Join.parse(req.body);
    const id = await store.takeInvite(code);
    const hh = id ? await store.getHousehold(id) : null;
    if (!id || !hh) return res.code(404).send(error('invite_invalid', 'That invite is wrong or has expired. Ask for a new one.'));
    if (req.user) {
      await ensureProfile(store, req.user.id);
      await store.addUserMember(id, req.user.id, 'member');
      await leaveOthers(req.user.id, id);
      return reply(id, hh.name, id);
    }
    const secret = newSecret();
    await store.addMember(id, hash(secret));
    return reply(id, hh.name, `${id}.${secret}`);
  });

  /** Who's in the household: people by name and ghost, plus how many devices still share without an account. */
  app.post('/v1/households/members', async (req, res) => {
    const who = await authed(req, res);
    if (!who) return res;
    const people = await store.listUserMembers(who.id);
    const total = await store.memberCount(who.id);
    return {
      people: people.map((p) => ({ ...p, you: p.userId === who.userId })),
      devices: total - people.length,
    };
  });

  /** The owner removes someone. Their own copy of the food stays on their devices. */
  app.post('/v1/households/remove', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, res) => {
    const who = await authed(req, res);
    if (!who) return res;
    const { userId } = Remove.parse(req.body);
    if (!who.userId || who.role !== 'owner') return res.code(403).send(error('not_owner', 'Only the household owner can remove people.'));
    if (userId === who.userId) return res.code(400).send(error('bad_request', 'To leave the household yourself, use Leave.'));
    const remaining = await store.removeUserMember(who.id, userId);
    notify(who.id);
    return { ok: true, remaining };
  });

  app.post('/v1/households/sync', { bodyLimit: 2 * 1024 * 1024, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, res) => {
    const who = await authed(req, res);
    if (!who) return res;
    const body = Sync.parse(req.body);
    const limit = now() + MAX_CLOCK_SKEW_MS;

    if (body.changes.length > 0) {
      for (const c of body.changes) {
        if (c.data && JSON.stringify(c.data).length > MAX_RECORD_BYTES) {
          return res.code(413).send(error('too_large', 'One of the items is too large to share.'));
        }
      }
      if ((await store.countSyncRecords(who.id)) + body.changes.length > MAX_RECORDS) {
        return res.code(413).send(error('household_full', 'This household holds as much data as it can. Clear old history on one device.'));
      }
      const clamped: SyncChange[] = body.changes.map((c) => ({
        ...c,
        updatedAt: Math.min(c.updatedAt, limit),
        // History entries say who did it ("Sam binned the milk"), from the session, not from the device.
        data: c.deleted ? null : c.collection === 'events' && who.userId ? { ...c.data, by: who.userId } : c.data,
      }));
      await store.putSyncChanges(who.id, body.deviceId, clamped);
      notify(who.id, body.deviceId);
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

  /**
   * Answers as soon as anything in the kitchen changes after `since` (from another device), or after
   * waitMs with `changed: false`. Open devices keep one of these waiting, so a change on one shows on
   * the others within a moment, without reloading. A refusal (left, removed) means: sync to find out.
   */
  app.post('/v1/households/wait', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, res) => {
    const who = await authed(req, res);
    if (!who) return res;
    const { deviceId, since } = Wait.parse(req.body);
    if ((await store.getSyncChanges(who.id, since, 1)).length) return { changed: true };
    const set = waiting.get(who.id) ?? new Set();
    if (set.size >= MAX_WAITERS) return { changed: false };
    waiting.set(who.id, set);
    const changed = await new Promise<boolean>((resolve) => {
      let finished = false;
      const done = (v: boolean) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        clearInterval(poll);
        set.delete(wake);
        if (set.size === 0 && waiting.get(who.id) === set) waiting.delete(who.id);
        res.raw.off('close', gone);
        resolve(v);
      };
      const wake = (fromDevice: string) => { if (fromDevice !== deviceId) done(true); };
      // The response's close event, not the request's: that one fires once the body has been read.
      const gone = () => done(false);
      const timer = setTimeout(() => done(false), waitMs);
      // Several server instances (Vercel) don't share this process's memory, so a change made through
      // another one never calls `wake` here. Looking in the database now and then catches it either way.
      const poll = setInterval(() => {
        void store.getSyncChanges(who.id, since, 1).then((rows) => { if (rows.length) done(true); }).catch(() => {});
      }, pollMs);
      set.add(wake);
      res.raw.on('close', gone);
    });
    return { changed };
  });

  /** Stop sharing. The owner's role passes to the longest-standing member; the last one out removes the data. */
  app.post('/v1/households/leave', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, res) => {
    const who = await authed(req, res);
    if (!who) return res;
    let left: number;
    if (who.userId) {
      left = await leaveAsUser(who.id, who.userId);
    } else if ('secretHash' in who) {
      left = await store.removeMember(who.id, who.secretHash);
      if (left === 0) await store.deleteHousehold(who.id);
    } else {
      left = await store.memberCount(who.id);
    }
    return { ok: true, remaining: left };
  });

  /** Removes the household and its data for everyone. With accounts, only its owner can. */
  app.post('/v1/households/delete', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, res) => {
    const who = await authed(req, res);
    if (!who) return res;
    if (who.userId && who.role !== 'owner') return res.code(403).send(error('not_owner', 'Only the household owner can delete it.'));
    await store.deleteHousehold(who.id);
    notify(who.id);
    return { ok: true };
  });
}
