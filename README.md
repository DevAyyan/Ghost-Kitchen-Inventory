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
- **Badges and sharing.** Badges and your run of quiet weeks are on the ledger, with a CO₂ and water estimate for what you rescued and binned. Share your week as a picture or as text. In a shared household, the ledger ranks who rescued the most this week.
- **Smarter lists.** Review flags food you already have and can show only the rows to check. The shopping list tells you when the food you're adding is already in the fridge and turning.
- **Tell the fridge.** Say or type "used half the milk and two eggs, threw out the spinach"; you confirm each line before anything changes. **Plan the next 3 days** picks meals that use the most turning food between them. Low-risk food you won't get to can be offered to neighbours with one tap.
- **Guided tour.** `/?tour=1` loads the sample fridge in demo mode and walks through the app in eight stops. Also in Settings → Demo mode. Pitch and video plan: `docs/pitch.md`.
- **Budget and your data.** An optional monthly grocery budget on the ledger. Settings → Data → Export my data saves everything as a JSON file (no photos, no server token).

Who it's for: a household that wants to waste less food and says so in money. The ledger (what you spent, saved and wasted) is the hook; the fridge is how it stays up to date.

One React Native (Expo) codebase runs as an Android app and as a website. Everything is free to run: open-source services in Docker, plus Gemini's free tier.

## Run it

Requires Docker and a [free Gemini API key](https://aistudio.google.com/apikey).

```bash
cp .env.example .env      # fill in every CHANGE_ME (database password, Gemini key)
docker compose up -d --build
```

Open <http://localhost:3000>. The server also serves the web app. The fridge starts empty: scan a receipt, add items by hand, or use **Try with sample data**.

The web app on port 3000 is built into the server image, so it only changes when the image is rebuilt. After pulling or editing client code, run `docker compose up -d --build api` and hard-refresh the page. For live reload while you work, use the Expo dev server on port 8081 instead (see **Develop**).

To have people sign in (Google or an emailed code, free through Clerk), put a Clerk publishable key in
`.env` as `CLERK_PUBLISHABLE_KEY`. Setup steps, including Clerk's free development Google sign-in: `docs/accounts.md`.

Check it's healthy: `curl localhost:3000/v1/status` (database, OCR and AI status; never shows secrets).

### Demo mode (no server, no internet)

Open `/?demo=1`. It loads the sample fridge and turns on demo mode: scanning, shelf-life lookups, recipes
and exchange rates answer from data recorded in the app (`apps/mobile/lib/demo`), and nothing is sent
anywhere. On the Scan tab, **Use the sample receipt** reads `docs/demo/sample-receipt.png`. Screens with
recorded answers say so, and the top bar shows **Demo**. Turn it off in Settings → Demo mode. Households
and sign-in need the real server.

Recipes are real TheMealDB recipes; refresh them with `cd apps/api && npx tsx scripts/record-demo-recipes.mts`.
Their diet labels are set by hand in `apps/mobile/lib/demo/products.ts` and fail closed: a diet is listed only
when every ingredient clearly fits it.

### Android

The Android app talks to your server over the network:

1. Put the server on HTTPS. Release Android builds block plain `http://` addresses. A free [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) or a reverse proxy with Let's Encrypt works; set `TRUST_PROXY=true` behind one.
2. Optionally set `API_TOKEN` in `.env` so only your devices can use the server.
3. Build an installable APK with the free tier of Expo's build service:
   ```bash
   cd apps/mobile
   # Optional: bake the server address into the build (the preview and production profiles read it from EAS).
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://kitchen.example.com --visibility plaintext
   npx eas-cli build -p android --profile preview
   ```
4. Without the step above the build has no address. In the app, open **Settings → Server**, enter the address (and token), and tap **Save and test connection**.

For development: `cd apps/mobile && npm install && npx expo start`, then open it in Expo Go. Set `EXPO_PUBLIC_API_URL=http://<your-computer's-LAN-IP>:3000` so the phone can reach your computer.

## Develop

```bash
docker compose up -d db ocr                        # database + OCR only

cd apps/api && npm install
DATABASE_URL=postgresql://ghost:<password>@127.0.0.1:5433/ghostkitchen npm run dev
npm test                                           # unit + API tests (no network, no AI)

cd apps/mobile && npm install
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web   # http://localhost:8081, reloads on save
npx tsc --noEmit
npm test                                           # domain logic, migrations, generated sprites
```

Browser tests (doors, open compartments, the ghost shortcut, adding food, a 320 px phone, and screenshot
comparisons of the pixel art) run against the exported web app, no server needed:

```bash
pip install -r e2e/requirements.txt && python3 -m playwright install chromium
cd apps/mobile && npx expo export --platform web && cd ../..
python3 e2e/serve.py apps/mobile/dist 8099 &
E2E_URL=http://127.0.0.1:8099 python3 -m pytest e2e      # UPDATE_BASELINES=1 after an intended visual change
```

Before an Android release, go through `docs/android-checklist.md` on a real phone.

To run the whole app on Vercel (web app, API and a free Neon database), see `docs/hosting.md`.

Pixel-art assets are generated (Python 3 with Pillow), so edit the scripts rather than the PNGs. CI reruns
them and fails if the committed PNGs don't match (`e2e/check_sprites.py`):

```bash
cd apps/mobile
python3 scripts/spookify-sprites.py     # grade the kitchen sprites, make the ajar frames
python3 scripts/make-pixel-assets.py    # door light, both-ajar frame, wall tiles, tile overlays, illustrations
python3 scripts/make-pixel-icons.py /tmp/pxi/package/svg   # pixel icons (see the script for the download)
node scripts/make-pixel-sounds.mjs      # spooky 8-bit sound effects
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

Full list, with licences: `apps/mobile/assets/CREDITS.md`.

- Kitchen sprites: "Pixel Art Fridge Pack" (Fridge 4, white). Ghost sprites: "Ghosts". **Licence terms still to be confirmed for both.**
- Pixel icons: [Pixelarticons](https://github.com/halfmage/pixelarticons) by Gerrit Halfmann, MIT License (`apps/mobile/components/ui/LICENSE-pixelarticons.txt`).
- Fonts: [VT323](https://fonts.google.com/specimen/VT323) and [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), SIL Open Font License 1.1 (`apps/mobile/assets/fonts`).
- Colours are inspired by the [Halloween UI kit (Icons8) on Figma Community](https://www.figma.com/design/POUVA3CQ3VZEhTOKPsoOKq/Halloween-UI-kit--Community-). No icons or illustrations from the kit are included.
- App icon ghost: [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (flat style), MIT License (`apps/mobile/components/halloween/LICENSE-fluent-emoji.txt`).
- Icon fallbacks: [Lucide](https://lucide.dev) and [Lucide Lab](https://github.com/lucide-icons/lucide-lab), ISC License.
