# Hosting everything on Vercel

One Vercel project runs the whole app as three services (`vercel.json` at the repository root):

| Service | Root | What it is | Reachable at |
|---|---|---|---|
| `web` | `apps/mobile` | Static Expo web export (`dist`) | `/` and every path not listed below |
| `api` | `apps/api` | Fastify, entry `apps/api/server.ts` | `/v1/*` and `/health` |
| `ocr` | `infra/ocr` | Tesseract container (`Dockerfile`) | Internal only, through the API |

The API reaches the OCR service through a service binding: Vercel sets `OCR_URL` on the `api` service at
runtime. The API already reads `OCR_URL` (`apps/api/src/config.ts`), so nothing else is needed. The web app
calls the API on its own address, so no CORS or server address settings are needed.

| Part | On Vercel | Locally (Docker) |
|---|---|---|
| Database | Neon Postgres from the Vercel Marketplace (free plan) | Postgres container |
| Live sync | Devices wait on `/v1/households/wait`; the API checks the database every 1.5 s | Same, plus an instant in-memory wake-up |

## Deploy

1. **Project.** vercel.com → **Add New → Project** → import this repository. Leave **Root Directory** at the
   repository root (empty). Vercel reads the services from `vercel.json`.
2. **Database.** In the project: **Storage → Create Database → Neon** (free plan). Connect it to the project;
   it adds `DATABASE_URL`. Tables are created on first use.
3. **Environment variables** (Settings → Environment Variables, Production and Preview):

   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | your key from Google AI Studio |
   | `CLERK_PUBLISHABLE_KEY` | from your Clerk dashboard (leave out to run without sign-in) |
   | `TRUST_PROXY` | `true` |
   | `MAX_UPLOAD_MB` | `4` (Vercel accepts request bodies up to 4.5 MB; the app sends receipts at about 1 MB) |
   | `PORT` | `8080` (the OCR container listens here; Vercel sends container traffic to port 80 unless this is set) |

   Don't set `OCR_URL`; the binding provides it. Optional: `GEMINI_RPD_LIMIT`, `MEALDB_API_KEY`, the other
   settings in `.env.example`.
4. **Deploy.** Open `https://<project>.vercel.app`. The judges' link is `/?tour=1`.
5. **Sign-in.** If Google sign-in fails on the new address, add it in the Clerk dashboard. A public launch
   needs Clerk's production instance on your own domain (`accounts.md`).

The `api` service builds with `npm run typecheck`, not `npm run build`. The Docker build writes `dist/`, and
when `dist/` exists Vercel serves `dist/app.js` (which has no request handler) instead of `server.ts`, so
every API request fails with `FUNCTION_INVOCATION_FAILED`.

The OCR container runs as a non-root user, so it listens on 8080 rather than 80. `PORT` doesn't affect the
other services: the API exports a request handler instead of opening a port, and the web app is static
files. If receipt scans fail and `/v1/status` shows OCR as down, check `PORT` first.

### Without the OCR container

Set `OCR_ENGINE=local` on the project and the API reads receipts in-process with `tesseract.js`. The `ocr`
service can then be removed from `vercel.json`. Scans are a little slower on a cold start.

## Limits of the free plans

- **Vercel Hobby** is for personal, non-commercial use. Each month it includes 4 hours of active CPU and
  360 GB-hours of function memory; over that, functions pause until the month is up. An open app keeps one
  request waiting for changes, which keeps an API instance running. Apps in the background stop waiting.
- **Vercel Services** are in beta, so details may change.
- **Neon Free** has 1 GB of storage and 100 compute-hours a month, and sleeps after 5 minutes idle (the first
  request after that takes a second or two longer).

## Rehearsing locally

`docker compose up -d --build` runs the same app with its own Postgres and OCR containers (see the README).
To run the Vercel services setup itself: start a Postgres, put its `DATABASE_URL` in `.env`, then
`npx vercel@latest dev --local` from the repository root.
