# Hosting everything on Vercel

One Vercel project runs the whole app, free:

| Part | On Vercel | Locally (Docker) |
|---|---|---|
| Web app | Static files from `apps/mobile/dist` | Served by the API container |
| API | One Vercel Function, `api/index.mjs` (Fastify inside) | `apps/api` container |
| Database | Neon Postgres from the Vercel Marketplace (free plan) | Postgres container |
| Receipt OCR | Tesseract in the function (`tesseract.js`, `OCR_ENGINE=local`) | Tesseract container (`infra/ocr`) |
| Live sync | Devices wait on `/v1/households/wait`; the function checks the database every 1.5 s | Same, plus an instant in-memory wake-up |

`vercel.json` at the repository root sets the install and build, the static output, clean URLs, the 404 page,
and rewrites `/v1/*` and `/health` to the function. The web app calls the API on its own address, so no CORS
or server address settings are needed.

## Deploy

1. **Project.** vercel.com → **Add New → Project** → import this repository. Leave **Root Directory** at the
   repository root (empty) and **Framework Preset** at **Other**.
2. **Database.** In the project: **Storage → Create Database → Neon** (free plan). Connect it to the project;
   it adds `DATABASE_URL`. Tables are created on first use.
3. **Environment variables** (Settings → Environment Variables, Production and Preview):

   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | your key from Google AI Studio |
   | `CLERK_PUBLISHABLE_KEY` | from your Clerk dashboard (leave out to run without sign-in) |
   | `OCR_ENGINE` | `local` |
   | `TRUST_PROXY` | `true` |
   | `MAX_UPLOAD_MB` | `4` (Vercel accepts request bodies up to 4.5 MB; the app sends receipts at about 1 MB) |

   Optional: `GEMINI_RPD_LIMIT`, `MEALDB_API_KEY`, the other settings in `.env.example`.
4. **Deploy.** Open `https://<project>.vercel.app`. The judges' link is `/?tour=1`.
5. **Sign-in.** If Google sign-in fails on the new address, add it in the Clerk dashboard. A public launch
   needs Clerk's production instance on your own domain (`accounts.md`).

## Limits of the free plans

- **Vercel Hobby** is for personal, non-commercial use. Each month it includes 4 hours of active CPU and
  360 GB-hours of function memory; over that, functions pause until the month is up. An open app keeps one
  request waiting for changes, which keeps a function instance (2 GB) running: roughly 180 hours of apps
  being open per month in total. Apps in the background stop waiting.
- **Neon Free** has 1 GB of storage and 100 compute-hours a month, and sleeps after 5 minutes idle (the first
  request after that takes a second or two longer).
- **Receipts** are read in about half a second once the function is warm; the first scan after a cold start
  takes a second or two more while Tesseract loads.

## Running it locally instead

`docker compose up -d --build` runs the same app with its own Postgres and OCR containers (see the README).
To rehearse the Vercel setup without deploying, see `apps/api/test/vercel-local.mjs`.
