import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError, z } from 'zod';
import type { Config } from './config.js';
import { AuthError, AuthUnavailable, createClerkVerifier, type AuthUser, type Verifier } from './auth.js';
import { registerProfileRoutes } from './profile.js';
import { BarcodeCode, BarcodeError, createBarcodes } from './barcode.js';
import { createItemPhotoScanner, ItemPhotoError } from './item-photo.js';
import type { Gemini } from './gemini.js';
import { registerHouseholdRoutes } from './households.js';
import type { MealDb } from './mealdb.js';
import type { Ocr } from './ocr.js';
import { createProductService, productKey } from './products.js';
import { createRates } from './rates.js';
import { createReceiptScanner, ScanError } from './receipts.js';
import { createRecipeService, SuggestRequest } from './recipes.js';
import type { Store } from './store.js';
import { createTonight, TonightRequest } from './tonight.js';
import { createVoice, VoiceRequest } from './voice.js';

export interface Deps {
  cfg: Config;
  store: Store;
  gemini: Gemini;
  ocr: Ocr;
  mealdb: MealDb;
  fetch?: typeof fetch;
  /** Session check, for tests. Otherwise built from CLERK_PUBLISHABLE_KEY. */
  verifier?: Verifier;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** The signed-in person, when Clerk sign-in is on. */
    user?: AuthUser;
  }
}

/** Routes that answer without a session: the app reads /v1/status to learn how to sign in. */
const PUBLIC = new Set(['/v1/status']);

/** Returns the MIME type for the image formats the OCR service can read, or null. */
export function sniffImage(b: Buffer): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const InfoRequest = z.object({
  names: z.array(z.string().trim().min(1).max(80)).min(1).max(60),
  useAi: z.boolean().default(true),
});

const error = (code: string, message: string) => ({ error: { code, message } });

export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  const { cfg, store, gemini, ocr, mealdb } = deps;
  // The web app the server itself serves needs no CORS; other origins must be listed explicitly.
  const app = Fastify({
    logger: {
      level: cfg.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-household-key"]'],
    },
    trustProxy: cfg.TRUST_PROXY === 'true',
    bodyLimit: 256 * 1024,
  });

  const products = createProductService(store, gemini);
  const scanner = createReceiptScanner(ocr, gemini, (reason) => app.log.warn({ reason }, 'receipt AI fallback'));
  const recipes = createRecipeService(mealdb, products);
  const itemPhotos = createItemPhotoScanner(gemini);
  const tonight = createTonight(gemini);
  const voice = createVoice(gemini);
  const rates = createRates(store, cfg.FX_BASE_URL, deps.fetch);
  const barcodes = createBarcodes(cfg.OFF_BASE_URL, deps.fetch);

  await app.register(cors, {
    origin: cfg.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-household-key'],
  });
  await app.register(rateLimit, {
    max: cfg.RATE_LIMIT_PER_MIN,
    timeWindow: '1 minute',
    // Only the API is limited. The web app's own files (one page load is ~60 scripts, fonts and sprites)
    // would otherwise use up the budget and break the app with 429s after a few reloads.
    allowList: (req) => !req.url.startsWith('/v1/'),
  });
  await app.register(multipart, { limits: { fileSize: cfg.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 6, parts: 8 } });

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    if (req.url.startsWith('/v1/')) reply.header('cache-control', 'no-store');
  });

  const verifier = deps.verifier ?? (cfg.CLERK_PUBLISHABLE_KEY
    ? createClerkVerifier({
      publishableKey: cfg.CLERK_PUBLISHABLE_KEY,
      authorizedParties: cfg.CLERK_AUTHORIZED_PARTIES.split(','),
      jwksUrl: cfg.CLERK_JWKS_URL,
      fetch: deps.fetch,
    })
    : null);
  if (verifier && cfg.API_TOKEN) app.log.warn('CLERK_PUBLISHABLE_KEY is set, so API_TOKEN is ignored: sign-in protects the API instead.');

  // Sign-in on: every API request (except status) needs a signed-in person.
  app.addHook('preHandler', async (req, reply) => {
    if (!verifier || !req.url.startsWith('/v1/') || req.method === 'OPTIONS') return;
    if (PUBLIC.has(req.url.split('?')[0]!)) return;
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
    try {
      if (!token) throw new AuthError('No session.');
      req.user = await verifier.verify(token);
    } catch (e) {
      if (e instanceof AuthUnavailable) {
        req.log.warn('Clerk signing keys unavailable');
        return reply.code(503).send(error('auth_unavailable', "Can't check sign-in right now. Try again in a moment."));
      }
      req.log.info({ reason: e instanceof Error ? e.message : 'unknown' }, 'session rejected');
      return reply.code(401).send(error('signed_out', 'Sign in again to keep going.'));
    }
  });

  // Optional shared token for private deployments without sign-in. This is a gate, not user authentication.
  app.addHook('preHandler', async (req, reply) => {
    if (verifier || !cfg.API_TOKEN || !req.url.startsWith('/v1/') || req.method === 'OPTIONS') return;
    const given = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
    const want = Buffer.from(cfg.API_TOKEN);
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      return reply.code(401).send(error('unauthorized', 'Missing or wrong API token.'));
    }
  });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    if (err instanceof ZodError) {
      // Which fields failed, so a client bug shows up in the log. Paths and messages only, never the values.
      req.log.info({ issues: err.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message })) }, 'invalid request');
      return reply.code(400).send(error('bad_request', err.issues[0]?.message ?? 'Invalid request.'));
    }
    if (err instanceof ItemPhotoError) return reply.code(err.status).send(error(err.code, err.message));
    if (err instanceof ScanError) return reply.code(err.status).send(error(err.code, err.message));
    if (err instanceof BarcodeError) return reply.code(err.status).send(error(err.code, err.message));
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') return reply.code(413).send(error('too_large', `Images can be at most ${cfg.MAX_UPLOAD_MB} MB.`));
    if (err.statusCode === 429) return reply.code(429).send(error('rate_limited', 'Too many requests. Wait a moment and try again.'));
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send(error('bad_request', err.message));
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send(error('internal', 'Something went wrong on the server.'));
  });

  app.get('/health', async (_req, reply) => {
    const ok = await store.ping();
    return reply.code(ok ? 200 : 503).send({ ok });
  });

  app.get('/v1/status', async () => {
    const [dbOk, ocrOk, used] = await Promise.all([store.ping(), ocr.ping(), store.aiUsedToday().catch(() => 0)]);
    return {
      ok: dbOk && ocrOk,
      db: dbOk,
      ocr: ocrOk,
      ai: { enabled: gemini.enabled, model: gemini.model, usedToday: used, limitPerDay: cfg.GEMINI_RPD_LIMIT },
      recipes: { provider: 'themealdb', keyType: cfg.MEALDB_API_KEY === '1' ? 'test' : 'supporter' },
      // The app signs in against this server's own Clerk app, so it learns the (public) key here.
      auth: verifier && cfg.CLERK_PUBLISHABLE_KEY ? { provider: 'clerk', publishableKey: cfg.CLERK_PUBLISHABLE_KEY } : { provider: 'none' },
    };
  });

  app.post('/v1/receipts/scan', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send(error('bad_request', 'Attach the receipt photo as the "image" field.'));
    const useAi = (file.fields.useAi as { value?: string } | undefined)?.value !== 'false';
    const image = await file.toBuffer();
    const contentType = sniffImage(image);
    if (!contentType) return reply.code(415).send(error('bad_image', 'Send a JPEG, PNG or WebP photo.'));
    return scanner.scan({ image, filename: file.filename || 'receipt', contentType, useAi });
  });

  app.post('/v1/items/scan', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send(error('bad_request', 'Attach the item photo as the "image" field.'));
    const image = await file.toBuffer();
    const contentType = sniffImage(image);
    if (!contentType) return reply.code(415).send(error('bad_image', 'Send a JPEG, PNG or WebP photo.'));
    return itemPhotos.scan({ image, contentType });
  });

  registerHouseholdRoutes(app, store, Date.now, { waitMs: cfg.HOUSEHOLD_WAIT_MS, pollMs: cfg.HOUSEHOLD_POLL_MS });
  registerProfileRoutes(app, store);

  app.post('/v1/tonight', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    return tonight.suggest(TonightRequest.parse(req.body));
  });

  app.post('/v1/voice/parse', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    return voice.parse(VoiceRequest.parse(req.body));
  });

  app.post('/v1/products/info', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req) => {
    const body = InfoRequest.parse(req.body);
    const out = await products.lookup(body.names, { useAi: body.useAi });
    const byName: Record<string, unknown> = {};
    for (const n of body.names) byName[n] = out.products.get(productKey(n)) ?? null;
    return { products: byName, ai: out.ai };
  });

  app.post('/v1/recipes/suggest', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = SuggestRequest.parse(req.body);
    try {
      return await recipes.suggest(body);
    } catch {
      return reply.code(502).send(error('recipes_unavailable', 'The recipe service is unavailable. Try again shortly.'));
    }
  });

  app.get('/v1/barcodes/:code', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { code } = z.object({ code: BarcodeCode }).parse(req.params);
    return barcodes.lookup(code);
  });

  app.get('/v1/rates', async (req, reply) => {
    const { base } = z.object({ base: z.string().regex(/^[A-Za-z]{3}$/).default('EUR') }).parse(req.query);
    try {
      return await rates.get(base);
    } catch {
      return reply.code(502).send(error('rates_unavailable', 'Exchange rates are unavailable right now.'));
    }
  });

  if (cfg.WEB_DIR && existsSync(cfg.WEB_DIR)) {
    const webDir = cfg.WEB_DIR;
    // Loaded only here: @fastify/static require()s an ESM-only package, which Vercel's function loader
    // rejects (ERR_REQUIRE_ESM). Only Docker serves the web app from the API; on Vercel it's its own service.
    const { default: fastifyStatic } = await import('@fastify/static');
    await app.register(fastifyStatic, { root: webDir, wildcard: false });
    // Expo's static export writes /recipes as recipes.html; serve those for deep links and reloads.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/v1/')) return reply.code(404).send(error('not_found', 'No such endpoint.'));
      if (req.method !== 'GET' && req.method !== 'HEAD') return reply.code(404).send(error('not_found', 'Not found.'));
      const path = decodeURIComponent(req.url.split('?')[0] ?? '/').replace(/\/+$/, '');
      const page = /^\/[a-z0-9_-]+(\/[a-z0-9_-]+)*$/i.test(path) ? `${path.slice(1)}.html` : null;
      if (page && existsSync(join(webDir, page))) return reply.type('text/html').sendFile(page);
      return reply.code(404).type('text/html').sendFile('+not-found.html');
    });
  }

  return app;
}
