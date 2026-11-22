import { loadConfig } from './config.js';
import { createServer } from './serve.js';

const cfg = loadConfig();
const { app, close } = await createServer(cfg);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await close();
    process.exit(0);
  });
}

await app.listen({ port: cfg.PORT, host: cfg.HOST });
