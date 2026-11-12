# Ghost Kitchen: Android + web client

Expo (React Native) app built with React Native Reusables (shadcn/ui for React Native) and NativeWind. One codebase runs as a native Android app and as a website.

The API is not built yet, so receipt reading, Gemini recipes and exchange rates are **simulated locally** (`lib/domain/samples.ts`, `lib/domain/recipes.ts`, `lib/currency/catalog.ts`). Data is saved on the device with AsyncStorage.

## Run

```bash
npm install
npx expo start          # press "a" for Android (Expo Go / emulator), "w" for web
npx expo start --web    # web only
npx tsc --noEmit        # typecheck
npx expo export --platform web   # static web build in dist/
```

Android install builds: `npx eas-cli build -p android --profile preview` (free tier, needs an Expo account), or `npx expo run:android` with the Android SDK installed.

## Layout

| Path | What |
|---|---|
| `app/(tabs)/` | Fridge, Scan, Recipes, Ledger, Graveyard, Settings |
| `app/review.tsx` | Receipt review and confirm (currency, lines, totals) |
| `components/ui/` | Reusables (shadcn) components, added with `npx @react-native-reusables/cli add <name>` |
| `components/` | App components: fridge, scan, recipes, currency, shell, common |
| `lib/domain/` | Expiry stages, catalog, recipes, receipt drafts (no React Native imports) |
| `lib/currency/` | Currency table, formatting, detection resolution, conversion |
| `lib/store/` | Zustand stores (app data, scan draft, toast) |
| `global.css`, `tailwind.config.js` | Design tokens (dark only), including stage colours |

See `../../docs/design-contract.md` for design rules and `../../docs/SDS.md` for architecture.
