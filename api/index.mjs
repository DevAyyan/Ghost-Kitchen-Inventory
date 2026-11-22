/**
 * The whole Ghost Kitchen API as one Vercel function. vercel.json rewrites /v1/* and /health here, adding
 * the original path as `__path`, and serves the web app as static files around it.
 *
 * The API is built once per function instance (database migrations included) and reused by every request
 * the instance serves. Requests are handed to Fastify's own request handler, so the API behaves exactly as
 * it does under Docker.
 */
import { createServer } from '../apps/api/dist/serve.js';

let ready = null;

function getApp() {
  ready ??= createServer().then(async ({ app }) => {
    await app.ready();
    return app;
  }).catch((e) => {
    ready = null; // try again on the next request (for example, the database was still waking up)
    throw e;
  });
  return ready;
}

/** The path the visitor asked for: from `__path` if Vercel passed the rewrite's destination, else as is. */
export function originalUrl(url) {
  const u = new URL(url ?? '/', 'http://internal');
  const path = u.searchParams.get('__path');
  if (!path || !path.startsWith('/')) return url ?? '/';
  u.searchParams.delete('__path');
  const query = u.searchParams.toString();
  return `${path}${query ? `?${query}` : ''}`;
}

export default async function handler(req, res) {
  let app;
  try {
    app = await getApp();
  } catch (e) {
    console.error('API failed to start', e);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'starting', message: 'The server is starting up. Try again in a moment.' } }));
    return;
  }
  req.url = originalUrl(req.url);
  app.server.emit('request', req, res);
}
