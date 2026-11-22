/**
 * Entry point for the `api` service on Vercel (vercel.json). Docker runs src/index.ts instead.
 *
 * Vercel's Fastify runtime picks the first of app, index, server, src/app, src/index, src/server that
 * imports 'fastify', so this file (which does, for the type) is found before src/app.ts. It exports a
 * request handler rather than calling listen(): the runtime only waits a second for listen(), and the API
 * first has to reach the database. The API is built once per instance and reused; each request is handed to
 * Fastify's own request handler, so routes, limits and errors behave exactly as they do under Docker.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { createServer } from './src/serve.js';

let ready: Promise<FastifyInstance> | null = null;

function getApp() {
  ready ??= createServer()
    .then(async ({ app }) => {
      await app.ready();
      return app;
    })
    .catch((e) => {
      ready = null; // the next request tries again (for example, the database was still waking up)
      throw e;
    });
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  let app: FastifyInstance;
  try {
    app = await getApp();
  } catch (e) {
    console.error('API failed to start', e);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'starting', message: 'The server is starting up. Try again in a moment.' } }));
    return;
  }
  app.server.emit('request', req, res);
}
