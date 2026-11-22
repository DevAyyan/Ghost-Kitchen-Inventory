/**
 * The real API with an in-memory store, fake AI and no sign-in, serving the exported web app. Only for
 * browser tests that need a live server (e2e/test_live_sync.py: two devices in one kitchen).
 *
 *   cd apps/api && PORT=3100 npx tsx test/e2e-server.mts
 */
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store.js';
import { fakeGemini, fakeMealDb, fakeOcr, testConfig } from './fakes.js';

const port = Number(process.env.PORT ?? 3100);
const web = fileURLToPath(new URL('../../mobile/dist', import.meta.url));
const app = await buildApp({
  cfg: testConfig({ WEB_DIR: web, HOUSEHOLD_WAIT_MS: '25000', RATE_LIMIT_PER_MIN: '1000' }),
  store: new MemoryStore(),
  gemini: fakeGemini(() => { throw new Error('no AI in browser tests'); }, false),
  ocr: fakeOcr([]),
  mealdb: fakeMealDb([], {}),
});
await app.listen({ port, host: '127.0.0.1' });
console.log(`e2e API on http://127.0.0.1:${port}`);
