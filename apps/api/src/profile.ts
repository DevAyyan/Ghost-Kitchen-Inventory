import type { FastifyInstance } from 'fastify';
import { AVATAR_COLOURS, ProfileUpdate } from './schemas.js';
import type { Profile, Store } from './store.js';

/**
 * A person's profile: the name and pixel ghost their housemates see, and the preferences that follow them
 * from device to device. Sign-in itself (email, Google, sessions) is Clerk's; this is the app's part.
 */

const error = (code: string, message: string) => ({ error: { code, message } });

/** Same ghost and colour for the same person until they choose their own. */
function defaultAvatar(userId: string): Profile['avatar'] {
  let h = 7;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const n = Math.abs(h);
  return { ghost: n % 5, colour: AVATAR_COLOURS[n % AVATAR_COLOURS.length]! };
}

/** The profile for a signed-in person, made on first use. */
export async function ensureProfile(store: Store, userId: string): Promise<Profile> {
  const existing = await store.getProfile(userId);
  if (existing) return existing;
  const p: Profile = { id: userId, displayName: 'New ghost', avatar: defaultAvatar(userId), prefs: {}, createdAt: new Date().toISOString() };
  await store.putProfile(p);
  return p;
}

export function registerProfileRoutes(app: FastifyInstance, store: Store) {
  app.get('/v1/me', async (req, reply) => {
    if (!req.user) return reply.code(401).send(error('signed_out', 'Sign in to see your profile.'));
    const p = await ensureProfile(store, req.user.id);
    return { profile: p, households: await store.userHouseholds(p.id) };
  });

  app.post('/v1/me', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!req.user) return reply.code(401).send(error('signed_out', 'Sign in to change your profile.'));
    const patch = ProfileUpdate.parse(req.body);
    const p = await ensureProfile(store, req.user.id);
    const next: Profile = {
      ...p,
      displayName: patch.displayName ?? p.displayName,
      avatar: patch.avatar ?? p.avatar,
      // Preferences merge, so a device that only knows some of them can't wipe the rest.
      prefs: { ...p.prefs, ...(patch.prefs ?? {}) },
    };
    await store.putProfile(next);
    return { profile: next };
  });

  /**
   * Forget this person: their profile and household memberships. The households (and the food in them) stay
   * for the other members; a household with no one left is removed. The Clerk account is deleted by the app.
   */
  app.post('/v1/me/delete', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!req.user) return reply.code(401).send(error('signed_out', 'Sign in first.'));
    const households = await store.userHouseholds(req.user.id);
    await store.deleteProfile(req.user.id);
    for (const h of households) if ((await store.memberCount(h.id)) === 0) await store.deleteHousehold(h.id);
    return { ok: true };
  });
}
