# Design Contract: Ghost Kitchen client (web + Android)

Applies the frontend-ui-engineering skill. Implementation: `apps/mobile` (Expo SDK 57, React Native 0.86, Expo Router, React Native Reusables (shadcn/ui port), NativeWind 4). Tokens live in `apps/mobile/global.css` and `tailwind.config.js`; `lib/theme.ts` mirrors them for navigation.

Implementation notes:
- Chips use `components/common/filter-chip.tsx`, not the Reusables `Toggle`: `Toggle` forwards its className into `TextClassContext`, which leaks container styles onto child text.
- Sheets use `components/common/responsive-sheet.tsx` (RN `Modal`), so the Android back button closes them.

## References and assumptions
No external reference catalogue was supplied. Decisions below are drawn from common patterns in inventory and pantry apps (dense item grids, status filters, bottom-sheet details on mobile) and from the earlier HTML prototype. They should be checked against real screens when references are available.

## Visual language
- **Theme:** dark only. A night-time kitchen lit by the fridge lamp. Background is deep blue-graphite; surfaces step up in lightness, not with shadows.
- **Accent:** one flat "fridge-light mint" primary for the main action per screen. No gradients on controls. No purple/indigo brand colour (the old prototype's gradient buttons are dropped).
- **Freshness is the only colourful system.** Five stage tokens: `--stage-fresh`, `--stage-aging`, `--stage-expiring`, `--stage-rotting`, `--stage-spoiled`. Every stage is shown with colour, an icon (Sprout, Hourglass, Flame, Bug, Ghost) and a text label, never colour alone.
- **Haunting effects** live on fridge food tiles, compartment lamps and the graveyard scene only (see "Costume layer" below). All are stilled by `prefers-reduced-motion` or the in-app setting.
- **Radius:** shadcn scale from `--radius: 0.5rem`. Cards `rounded-lg`, chips/badges `rounded-full`, fridge cabinet `rounded-xl`. No `rounded-2xl+` elsewhere.
- **Spacing:** Tailwind 0.25rem scale only. No arbitrary pixel values.
- **Type:** System font (Roboto on Android) for all body and UI text. The gothic display face (Grenze Gotisch Bold, `font-display`) is used only for page `h1`s, the wordmark and tombstone engravings, and never below `text-sm` or for anything people need to read at length. One `h1` per page, `h2` per section; numbers use `tabular-nums`.

## Costume layer
The spooky design must carry information. Every effect stands for one state, is decorative to assistive tech (`aria-hidden`), and the same fact is always given in words, in the item's label or on screen. Under reduced motion each effect becomes a still frame that still reads.

| Effect | Means | Where | In words |
|---|---|---|---|
| Yellow cast over the photo | Aging | Food tile | Stage label |
| Breathing ember ring | Expiring | Food tile | Stage label, days left |
| Mould spots (more the longer it's over) + flies | Rotting | Food tile | Stage label, "2d over" |
| Ghost rising out of the food, faded photo | Spoiled | Food tile | Stage label; "N spirits in here" on the compartment |
| Cobweb in the corner | Forgotten: full and untouched for 3+ weeks (`FORGOTTEN_DAYS`) | Food tile | "untouched for 4 weeks" in the tile label |
| Flickering, cold lamp | Something in this compartment has spoiled | Freezer / fridge | "N spirits in here" + group label "N spoiled" |
| Tombstone height | Money lost on that item, relative to the costliest grave | Graveyard | Amount on the stone + "The bigger the stone…" |
| Moon, drifting fog, leaning stones | Atmosphere only | Graveyard | — |

Rules: one meaning per effect (cobwebs never mean anything but "forgotten"). Effects never cover the name, the days-left text or the stage icon. Mould and decay use the stage hues, so freshness stays the only colourful system. Implementation: `components/fridge/haunt-effects.tsx`, `lib/domain/haunt.ts`, `components/graveyard/graveyard-scene.tsx`.

## Screens: job, primary action, required states
| Screen | Job | Primary action | States |
|---|---|---|---|
| Fridge | See everything and what is about to turn | Scan receipt (mobile FAB) / Summon recipes (desktop) | empty fridge, filter with no match, spoiled callout |
| Item details | Decide what to do with one item | Lay to rest (used) | expiring, rotting (advice), spoiled/high-risk (discard only) |
| Scan | Get a receipt into a reviewable draft | Take photo / Choose image | idle, processing (step list), error (retry + manual), offline |
| Review receipt | Fix extraction, currency and expiry dates, add photos, then commit | Confirm & stock fridge (blocked until every expiry date is confirmed) | low-confidence rows, uncertain currency, subtotal mismatch, unconfirmed dates, empty draft |
| Recipes | Use at-risk food | Cook this (Plan is secondary) | nothing at risk, generating (skeletons), error, fewer than 3 matches, cooked |
| Plan & shop | Plan meals before food turns; one shopping list | Plan a meal | no meals, turning with no meal planned, planned too late, empty list, shared household |
| Ledger | Show money spent, saved and wasted | Change display currency | single currency, converted, uncovered currency (per-currency) |
| Graveyard | Show the cost of waste | — | empty (on phones, opened from the Ledger) |
| Settings | Currency, diet, privacy, motion | — | Tesseract-only, offline |

## Responsive rules (mobile first)
- `< md (768px)`, which includes Android: top app bar, bottom navigation (5 items: Fridge, Scan, Recipes, Plan, Ledger; 48dp targets; Settings in the top bar, Graveyard from the Ledger), FAB for Scan on the fridge. Details, pickers and confirmations open in a bottom **Drawer**. Fridge zones stack and the door becomes a horizontal shelf.
- `md`–`lg`: left navigation rail. Details open in a right **Sheet**. Dialogs for confirmations.
- `≥ xl (1280px)`: a persistent right "Haunting now" panel lists at-risk items.
- Mouse or trackpad on web (`useCanHover`, any width): resting on a food tile for 350 ms opens a small hover card summarising its stage, what that means, the date, amount left and value. It is a shortcut only (everything in it is also in the tile label and details), never on touch or Android, and clicking the tile dismisses it.
- Recipes: 10 per page, with page numbers under the list (compact "1 … 5 6" beyond 5 pages, so it fits 320px).
- Check at 320, 768, 1024 and 1440px.

## URL state
`/fridge?stage=expiring&q=milk&item=<id>`. Filters, search and the open item live in the URL, so they can be shared and so the Android back button (history) closes the detail drawer.

## Patterns to reject
Stock 3-up card grids for the fridge, hero banners, gradient buttons, glassmorphism, shadow stacks, emoji or illustrations for food (food is shown with the user's own photos; items without one get a neutral line icon), colour-only status, spinners where skeletons fit, modals on mobile when a drawer works.
