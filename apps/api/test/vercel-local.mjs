/**
 * A local stand-in for Vercel, to rehearse a deployment: serves apps/mobile/dist the way vercel.json
 * describes (clean URLs, 404.html) and sends /v1/* and /health to the real function (api/index.mjs)
 * through the same rewrite, `__path` included. Needs `npm run build` in apps/api and a web export first.
 *
 *   DATABASE_URL=postgres://... OCR_ENGINE=local PORT=3200 node apps/api/test/vercel-local.mjs
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const web = join(root, 'apps/mobile/dist');
const { default: handler } = await import(join(root, 'api/index.mjs'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  const api = url.pathname === '/health' || url.pathname.startsWith('/v1/');
  if (api) {
    // vercel.json: { source: "/v1/:path*", destination: "/api?__path=/v1/:path*" }; the query is kept.
    const q = new URLSearchParams(url.search);
    q.set('__path', url.pathname);
    req.url = `/api?${q}`;
    return handler(req, res);
  }
  // Static, with cleanUrls: /ledger -> ledger.html; unknown -> 404.html.
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(web, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file)) { res.statusCode = 404; file = join(web, '404.html'); }
  res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT ?? 3200), '127.0.0.1', () => console.log(`Vercel stand-in on http://127.0.0.1:${process.env.PORT ?? 3200}`));
