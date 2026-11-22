# Hosting: web app on Vercel, server on your computer

Vercel hosts the web app (a static export). The server can't run there: it needs Docker (Postgres and the
Tesseract OCR container) and a process that stays up, because live sync between devices holds requests
open in memory. It stays on your computer and is reached over a free HTTPS tunnel.

```
phone / laptop / judges ──▶ https://<project>.vercel.app   (web app, Vercel)
                                     │
                                     ▼
                      https://<tunnel>.trycloudflare.com   (Cloudflare Tunnel)
                                     │
                                     ▼
                    your computer: docker compose (API, Postgres, OCR)
```

Demo mode (`/?demo=1`, `/?tour=1`) needs no server, so the tour works even when your computer is off.

## 1. Server over HTTPS

With Docker running and the stack up (`docker compose up -d`):

```bash
cloudflared tunnel --no-autoupdate --url http://localhost:3000
```

It prints `https://<words>.trycloudflare.com`. That address changes every time the tunnel starts. For a
permanent one, make a named tunnel on a domain you have in Cloudflare
(<https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/>).

In `.env`, then `docker compose up -d api`:

```
CORS_ORIGINS=https://<project>.vercel.app
TRUST_PROXY=true
```

Optional hardening: `CLERK_AUTHORIZED_PARTIES` set to every origin you open the app from (the Vercel
address, `http://localhost:3000`, your LAN address). Left empty, sign-ins from any origin are accepted.

Change the database password from the example's `CHANGE_ME`. Postgres keeps the password it was created
with, so change it there first, then put the same one in `.env`:

```bash
docker compose exec db psql -U ghost -d ghostkitchen -c "ALTER USER ghost PASSWORD '<new password>'"
# edit POSTGRES_PASSWORD in .env, then:
docker compose up -d api
```

## 2. Web app on Vercel

1. vercel.com → **Add New → Project** → import this GitHub repository.
2. **Root Directory:** `apps/mobile`. **Framework Preset:** Other. `apps/mobile/vercel.json` sets the build
   (`expo export --platform web`), the output (`dist`), clean URLs and the 404 page.
3. **Environment variable:** `EXPO_PUBLIC_API_URL` = your tunnel address (Production and Preview). It's
   built into the app, so a new tunnel address needs **Redeploy**. People can also type a server address
   in Settings → Server.
4. Deploy. If Vercel gives a different address than the one in `CORS_ORIGINS`, update `.env` and restart
   the API.

## 3. Sign-in

Clerk development instances work on the Vercel address. If Google sign-in fails there, add the domain in
the Clerk dashboard. A public launch needs Clerk's production instance on your own domain (`accounts.md`).

## Keeping it up

Your computer, Docker and the tunnel must stay running for accounts and sync. Restarting the tunnel gives a
new address: set it in Vercel and redeploy. Vercel's free Hobby plan is for personal, non-commercial use.
