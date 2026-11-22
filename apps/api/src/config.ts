import { z } from 'zod';

/** Empty strings in .env mean "unset". */
const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const Env = z.object({
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  OCR_URL: z.string().url().default('http://localhost:8080'),

  GEMINI_API_KEY: optional,
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
  /** Daily request budget for the whole server (free tiers are per project, not per user). */
  GEMINI_RPD_LIMIT: z.coerce.number().int().positive().default(250),
  /** Free-tier quotas reset at midnight Pacific time. */
  GEMINI_QUOTA_TZ: z.string().default('America/Los_Angeles'),
  /** Requests per minute allowed for GEMINI_MODEL (free tier for 3.5 Flash: 5 per minute). */
  GEMINI_RPM_LIMIT: z.coerce.number().int().positive().default(5),
  /** Used when the main model is rate limited or overloaded. Empty string disables the fallback. */
  GEMINI_FALLBACK_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_FALLBACK_RPM_LIMIT: z.coerce.number().int().positive().default(10),
  /** Per HTTP attempt. */
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(40_000),
  /** Upper bound for one logical request, including retries and the fallback model. */
  GEMINI_DEADLINE_MS: z.coerce.number().int().positive().default(60_000),

  /** "1" is TheMealDB's public test key. Releasing publicly on an app store needs a supporter key. */
  MEALDB_API_KEY: z.string().default('1'),
  MEALDB_BASE_URL: z.string().url().default('https://www.themealdb.com/api/json/v1'),
  FX_BASE_URL: z.string().url().default('https://api.frankfurter.dev/v2'),
  /** Barcode lookups (free, no key). */
  OFF_BASE_URL: z.string().url().default('https://world.openfoodfacts.org'),

  /** Comma-separated browser origins allowed to call the API. Native apps send no Origin. */
  CORS_ORIGINS: z.string().default(''),
  /** If set, every /v1 request must send `Authorization: Bearer <token>`. Ignored when Clerk sign-in is on. */
  API_TOKEN: optional,
  /**
   * Clerk sign-in (free Hobby plan). When set, every /v1 request except /v1/status needs a signed-in user,
   * and the app is told this key through /v1/status. Create a Clerk app and copy its publishable key.
   */
  CLERK_PUBLISHABLE_KEY: optional,
  /** Comma-separated web origins allowed to use the sessions (the token's `azp`). Empty = any. */
  CLERK_AUTHORIZED_PARTIES: z.string().default(''),
  /** Override for Clerk's key endpoint (tests, or a proxied Clerk). */
  CLERK_JWKS_URL: optional,
  /** Directory of the exported web app to serve at /, if any. */
  WEB_DIR: optional,
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(120),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  /** How long a device's "tell me when my kitchen changes" request is held open before it's answered anyway. */
  HOUSEHOLD_WAIT_MS: z.coerce.number().int().min(10).max(60_000).default(25_000),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${problems}`);
  }
  return parsed.data;
}
