# Ghost Kitchen

Turn grocery receipts into a fridge you can see, and cook what's about to spoil before it's wasted.

- **Add food the easy way.** Snap a single item and Gemini names it and reads the date printed on the pack (no typing, no price), or scan a receipt: Tesseract reads the text and Gemini identifies each item, its price and the currency.
- **Expiry dates that don't get in the way.** Gemini estimates shelf life per product and storage section. Checking a date against the package is optional; unchecked dates stay marked "est." until you do.
- **A nudge when it matters.** An opt-in daily notification (Android) names what needs cooking, only on days something is at risk. The fridge shows one "Cook this tonight" idea.
- **See your food.** A freezer, fridge and pantry with your own photos of each item, coloured by freshness.
- **Cook it.** Real recipes from [TheMealDB](https://www.themealdb.com) that use what's turning, filtered by diet.
- **Plan and shop.** Plan meals for the week around what's turning; the app flags food that will go off before any planned meal uses it, and meals planned after an ingredient's date. One shopping list collects what planned meals are missing and what you just used up.
- **Share a household.** Create a household on one device and invite the others with a one-time code. Fridge, history, plan and shopping list stay in step through your server (photos stay on the phone that took them).
- **It learns.** Mark something as "went off early" and, after it happens twice, new estimates for that food get shorter (never longer, never below half). Non-high-risk food at its date can get a "still looks fine" check that pushes it back 2 days, at most twice; meat, fish, eggs, dairy and leftovers never can.
- **A weekly digest.** Every Monday: what you rescued and threw out last week in money, compared with the week before, and what's turning next. A notification on Android, a card on the fridge screen everywhere.
- **Track money.** Spend, waste avoided and wasted, in any currency, converted with daily reference rates from [Frankfurter](https://frankfurter.dev).

Who it's for: a household that wants to waste less food and says so in money. The ledger (what you spent, saved and wasted) is the hook; the fridge is how it stays up to date.

One React Native (Expo) codebase runs as an Android app and as a website. Everything is free to run: open-source services in Docker, plus Gemini's free tier.

## Run it

Requires Docker and a [free Gemini API key](https://aistudio.google.com/apikey).

```bash
cp .env.example .env      # fill in every CHANGE_ME (database password, Gemini key)
docker compose up -d --build
```

Open <http://localhost:3000>. The server also serves the web app. The fridge starts empty: scan a receipt, add items by hand, or use **Try with sample data**.

Check it's healthy: `curl localhost:3000/v1/status` (database, OCR and AI status; never shows secrets).

### Android

The Android app talks to your server over the network:

1. Put the server on HTTPS. Release Android builds block plain `http://` addresses. A free [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) or a reverse proxy with Let's Encrypt works; set `TRUST_PROXY=true` behind one.
2. Optionally set `API_TOKEN` in `.env` so only your devices can use the server.
3. Build an installable APK with the free tier of Expo's build service:
   ```bash
   cd apps/mobile
   npx eas-cli build -p android --profile preview
   ```
4. In the app, open **Settings → Server**, enter the address (and token), and tap **Save and test connection**.

For development: `cd apps/mobile && npm install && npx expo start`, then open it in Expo Go. Set `EXPO_PUBLIC_API_URL=http://<your-computer's-LAN-IP>:3000` so the phone can reach your computer.

## Develop

```bash
docker compose up -d db ocr                        # database + OCR only

cd apps/api && npm install
DATABASE_URL=postgresql://ghost:<password>@127.0.0.1:5433/ghostkitchen npm run dev
npm test                                           # unit + API tests (no network, no AI)

cd apps/mobile && npm install
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web
npx tsc --noEmit
```

## Is it working? (two-week household test)

The riskiest assumption is that people keep their fridge up to date. Before building more, run it with 3 to 5 households for two weeks and record:
- Week 3 retention: how many are still adding food or opening the app.
- Time to add a shop: under 30 seconds per item photo, under 3 minutes with a receipt.
- Reminder effect: of the items named in a notification, how many were used before spoiling.
- Trust: did a wrong date ever make someone stop trusting the app?

## Before a public release

- **TheMealDB key.** The default key `1` is TheMealDB's test key. Their terms require a supporter key for apps released on an app store: set `MEALDB_API_KEY`.
- **Gemini free tier.** Limits are per Google project and change over time; set `GEMINI_RPM_LIMIT` and `GEMINI_RPD_LIMIT` to what [AI Studio](https://aistudio.google.com/rate-limit) shows. On the free tier, Google may use submitted content (receipt text, product names) to improve its products. The app tells users this before the first scan and lets them turn AI off.
- **Self-hosted, on purpose.** This is a household tool you run yourself. A consumer app would need accounts, a hosted backend and a different AI cost model; that is a separate project, not a setting.
- **Item photos.** Unlike receipts (text only), an item photo is sent to Gemini as an image. The app asks first, and the feature is off when AI is off.
- **Accounts.** There are no user accounts. Each device keeps its own copy locally; a shared household is joined with a single-use invite code that expires after 10 minutes, and each device gets its own key (only a hash is stored on the server). Anyone with a device in the household can read and change its data. The server itself is shared by whoever can reach it (use `API_TOKEN`). That suits a household server, not a public multi-user service.
- **Food safety.** Shelf-life figures are estimates. Users confirm every date, and the app says so, but it is guidance, not a guarantee.

## Layout

| Path | What |
|---|---|
| `apps/mobile` | Expo app (Android + web): React Native, Expo Router, React Native Reusables, NativeWind |
| `apps/api` | Fastify API: OCR → Gemini receipt reading, Gemini shelf life, TheMealDB recipes, exchange rates |
| `infra/ocr` | Tesseract OCR service |
| `docs` | Requirements (SRS), design (SDS), design contract |

## Credits

- Colours and fonts are inspired by the [Halloween UI kit (Icons8) on Figma Community](https://www.figma.com/design/POUVA3CQ3VZEhTOKPsoOKq/Halloween-UI-kit--Community-). No icons or illustrations from the kit are included.
- [Mountains of Christmas](https://fonts.google.com/specimen/Mountains+of+Christmas) by Tart Workshop, Apache License 2.0.
- [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) by Mathieu Triay, SIL Open Font License 1.1.
- Icons: [Lucide](https://lucide.dev), ISC License.
