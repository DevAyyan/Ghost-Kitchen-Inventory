import { createPublicKey, createVerify, type JsonWebKey, type KeyObject } from 'node:crypto';

/**
 * Checks Clerk session tokens (short-lived RS256 JWTs the app gets from Clerk) without Clerk's SDK: the
 * server only has to confirm who is calling, and Node's crypto does that. Clerk's public keys come from
 * its JWKS endpoint, cached, with a timeout; if Clerk can't be reached the cached keys are used.
 */

export interface AuthUser {
  /** Clerk user id, e.g. user_2abc… */
  id: string;
  sessionId: string | null;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Sessions can't be checked right now (Clerk's keys couldn't be loaded): our problem, not a signed-out user. */
export class AuthUnavailable extends Error {
  constructor() {
    super("Can't check sign-in right now.");
    this.name = 'AuthUnavailable';
  }
}

/**
 * Clerk's frontend API host, from a publishable key: `pk_test_` or `pk_live_` followed by the base64 of
 * `<host>$`. Returns null for anything else.
 */
export function frontendApi(publishableKey: string): string | null {
  const m = /^pk_(test|live)_([A-Za-z0-9+/=_-]+)$/.exec(publishableKey.trim());
  if (!m) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(m[2]!, 'base64').toString('utf8');
  } catch {
    return null;
  }
  if (!decoded.endsWith('$')) return null;
  const host = decoded.slice(0, -1);
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? host : null;
}

interface Jwk extends JsonWebKey { kid?: string; alg?: string; use?: string }

const JWKS_TTL_MS = 60 * 60_000;
const JWKS_TIMEOUT_MS = 5_000;
/** Clock difference tolerated between this server and Clerk. */
const LEEWAY_S = 10;

export interface Verifier {
  verify(token: string): Promise<AuthUser>;
}

export function createClerkVerifier(opts: {
  publishableKey: string;
  /** Browser origins allowed in the token's `azp`. Tokens without `azp` (native apps) are accepted. */
  authorizedParties?: string[];
  /** Override for tests or a proxied Clerk. Defaults to https://<frontend api>/.well-known/jwks.json. */
  jwksUrl?: string;
  fetch?: typeof fetch;
  now?: () => number;
}): Verifier {
  const host = frontendApi(opts.publishableKey);
  if (!host) throw new Error('CLERK_PUBLISHABLE_KEY is not a Clerk publishable key (pk_test_… or pk_live_…).');
  const issuer = `https://${host}`;
  const jwksUrl = opts.jwksUrl ?? `${issuer}/.well-known/jwks.json`;
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const parties = (opts.authorizedParties ?? []).map((p) => p.trim().replace(/\/+$/, '')).filter(Boolean);

  let keys = new Map<string, KeyObject>();
  let fetchedAt = 0;
  let loading: Promise<void> | null = null;

  async function loadKeys() {
    loading ??= (async () => {
      try {
        const res = await doFetch(jwksUrl, { signal: AbortSignal.timeout(JWKS_TIMEOUT_MS) });
        if (!res.ok) throw new Error(`JWKS HTTP ${res.status}`);
        const body = (await res.json()) as { keys?: Jwk[] };
        const next = new Map<string, KeyObject>();
        for (const k of body.keys ?? []) {
          if (k.kty !== 'RSA' || !k.kid || (k.use && k.use !== 'sig')) continue;
          next.set(k.kid, createPublicKey({ key: k, format: 'jwk' }));
        }
        if (next.size) { keys = next; fetchedAt = now(); }
      } catch {
        // Keep the keys we have: Clerk being briefly unreachable shouldn't sign everyone out.
      } finally {
        loading = null;
      }
    })();
    await loading;
  }

  async function keyFor(kid: string) {
    if (!keys.has(kid) || now() - fetchedAt > JWKS_TTL_MS) await loadKeys();
    return keys.get(kid) ?? null;
  }

  return {
    async verify(token) {
      const parts = token.split('.');
      if (parts.length !== 3) throw new AuthError('Malformed token.');
      const [h, p, s] = parts as [string, string, string];
      let header: { alg?: string; kid?: string };
      let claims: { sub?: string; sid?: string; iss?: string; exp?: number; nbf?: number; azp?: string };
      try {
        header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
        claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
      } catch {
        throw new AuthError('Malformed token.');
      }
      // Only RS256: never let the token pick a weaker algorithm (or "none").
      if (header.alg !== 'RS256' || !header.kid) throw new AuthError('Unsupported token.');
      const key = await keyFor(header.kid);
      if (!key) {
        // No keys at all means Clerk was never reached (a new server instance while it's unreachable).
        if (keys.size === 0) throw new AuthUnavailable();
        throw new AuthError('Unknown signing key.');
      }
      const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(key, Buffer.from(s, 'base64url'));
      if (!ok) throw new AuthError('Bad signature.');

      const t = Math.floor(now() / 1000);
      if (typeof claims.exp !== 'number' || claims.exp + LEEWAY_S < t) throw new AuthError('Session expired.');
      if (typeof claims.nbf === 'number' && claims.nbf - LEEWAY_S > t) throw new AuthError('Token not valid yet.');
      if (claims.iss !== issuer) throw new AuthError('Wrong issuer.');
      if (claims.azp && parties.length && !parties.includes(claims.azp.replace(/\/+$/, ''))) throw new AuthError('Wrong origin.');
      if (!claims.sub || !/^user_[A-Za-z0-9]+$/.test(claims.sub)) throw new AuthError('No user in token.');
      return { id: claims.sub, sessionId: claims.sid ?? null };
    },
  };
}
