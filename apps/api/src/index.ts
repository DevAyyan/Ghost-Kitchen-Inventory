import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createGemini } from './gemini.js';
import { createMealDb } from './mealdb.js';
import { createOcr } from './ocr.js';
import { PgStore } from './store.js';

const cfg = loadConfig();
const store = new PgStore(cfg.DATABASE_URL, cfg.GEMINI_QUOTA_TZ);

// The database container may still be starting; retry for a while before giving up.
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
  ocr: createOcr(cfg.OCR_URL),
  mealdb: createMealDb(cfg.MEALDB_BASE_URL, cfg.MEALDB_API_KEY),
});

if (cfg.MEALDB_API_KEY === '1') {
  app.log.warn('Using TheMealDB test key "1". It is for development only: a public app-store release needs a supporter key (MEALDB_API_KEY).');
}
if (!cfg.GEMINI_API_KEY) app.log.warn('GEMINI_API_KEY is not set: receipts use basic rules and shelf-life lookups are unavailable.');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await store.close();
    process.exit(0);
  });
}

await app.listen({ port: cfg.PORT, host: cfg.HOST });
