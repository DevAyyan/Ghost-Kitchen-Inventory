import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { loadConfig, type Config } from './config.js';
import { createGemini } from './gemini.js';
import { createMealDb } from './mealdb.js';
import { createOcr } from './ocr.js';
import { createLocalOcr } from './ocr-local.js';
import { PgStore } from './store.js';

/**
 * The API with its real dependencies, for both ways it runs: a long-lived server (src/index.ts, Docker)
 * and the `api` service on Vercel, whose Fastify runtime runs src/index.ts and takes over its listen() call.
 */
export async function createServer(cfg: Config = loadConfig()): Promise<{ app: FastifyInstance; close: () => Promise<void> }> {
  const store = new PgStore(cfg.DATABASE_URL, cfg.GEMINI_QUOTA_TZ);
  // The database may still be starting (Docker) or waking from sleep (Neon): retry for a while.
  for (let attempt = 1; ; attempt++) {
    try {
      await store.migrate();
      break;
    } catch (e) {
      if (attempt >= 20) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  const app = await buildApp({
    cfg,
    store,
    gemini: createGemini(cfg, store),
    ocr: cfg.OCR_ENGINE === 'local' ? createLocalOcr() : createOcr(cfg.OCR_URL),
    mealdb: createMealDb(cfg.MEALDB_BASE_URL, cfg.MEALDB_API_KEY),
  });
  if (cfg.MEALDB_API_KEY === '1') {
    app.log.warn('Using TheMealDB test key "1". It is for development only: a public app-store release needs a supporter key (MEALDB_API_KEY).');
  }
  if (!cfg.GEMINI_API_KEY) app.log.warn('GEMINI_API_KEY is not set: receipts use basic rules and shelf-life lookups are unavailable.');
  return { app, close: async () => { await app.close(); await store.close(); } };
}
