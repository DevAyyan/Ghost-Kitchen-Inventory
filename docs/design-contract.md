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
| Cobweb in the photo's corner | Forgotten: full and untouched for 3+ weeks (`FORGOTTEN_DAYS`) | Food tile | "untouched for 4 weeks" in the tile label |
| Flickering, cold lamp | Something in this compartment has spoiled | Freezer / fridge | "N spirits in here" + group label "N spoiled" |
| Tombstone height | Money lost on that item, relative to the costliest grave | Graveyard | Amount on the stone + "The bigger the stone…" |
| Magnets on a closed door | How many items of each stage are inside (icon + count + word) | Freezer / fridge / pantry door | The magnets are words; the door's button label repeats them |
| Ember light through the door gaps | Something inside is expiring | Closed door | Door label ("5 expiring") |
| Ghost peeking from the door gap | Something inside has spoiled | Closed door | Door label ("2 spoiled") |
| Cobweb on the door | Something inside is forgotten | Closed door (top-right, clear of the magnets and the steel engraving) | Door label ("1 forgotten") |
| Moon, drifting fog, leaning stones | Atmosphere only | Graveyard | — |

### Storage doors
Each section (freezer, fridge, pantry) has a door drawn over its shelves (`components/fridge/storage-door.tsx`). The shelves always render underneath, so a compartment keeps its real height and grows with the food; the door art (`door-faces.tsx`, react-native-svg) is drawn at the measured size, never a fixed image.
- Doors start open on first use and remember what the user shuts (`settings.doorsClosed`). A search or stage filter opens the doors with matches and shuts the rest, without changing what's remembered.
- Closed: the whole door is one button ("Fridge door, closed. 12 items: 2 spoiled, … Open it.", `aria-expanded=false`). The food behind it is `inert` on web and hidden from screen readers, and its effects rest (`Dormant`).
- Open: a "Close" button (44 px) in the section header. Focus moves to Close after opening and back to the door after closing.
- Opening swings the leaf on its hinge (two leaves for the pantry); reduced motion opens instantly.
- Wide screens (≥ 1024 px) cap each section (freezer 2 shelves, fridge and pantry 4) and scroll inside it; phones let it grow.
- A shut door shrinks to a short panel (steel 144 px, pantry 176 px) showing its magnets and handle, so closing a section saves scrolling. It shrinks after the swing finishes and grows back to full height as it opens.
- "Tap to open" / "Click to open" shows on doors until the user has opened doors by hand 3 times (`settings.doorOpens`).
- Opening or shutting a door by hand plays that door's sound (fridge: rubber seal and hum, freezer: seal and cold hiss, pantry: creaking hinge and wooden knock) with a light haptic tap (`lib/feedback.ts`). Doors that move for a search stay silent. "Sounds and vibration" in Settings turns both off. Sounds are generated by `apps/mobile/scripts/make-door-sounds.mjs`, so they carry no third-party licence.

- Open sections also have a 44 px close strip down their right edge (a handle bar only, no icon: steel on the fridge and freezer, brass on the pantry). The appliance body has no handles of its own, so each section shows exactly one handle: the door's when shut, the strip's when open. Clicking or tapping anywhere on it shuts the door. It's a pointer and touch shortcut for the header's Close button, so it stays out of the tab order and screen readers.

### Ghost motion
Ghosts are small physics bodies stepped every frame (`useFrameCallback`, `components/fridge/ghost.tsx`), each with its own randomness so no two move alike. Two layers:
- Movement. Rising (spoiled tile): pulsing buoyancy against air drag, a smoothly wandering breeze with the odd gust, held over the food by a soft spring; it materialises (fades in and swells), thins out near the top and re-forms after a random pause. Peeking (closed door): an under-damped spring that pops it out of the gap with overshoot, random duck-backs and half-peeks, and a smooth bob.
- Shape (`LivingGhost`, an SVG redrawn every frame). The hem ripples faster and deeper with speed and trails behind sideways motion on its own spring. It leans and squashes or stretches on springs, the eyes look where it's heading, it blinks at random (sometimes twice), and the mouth opens as it speeds up.
- No value jumps: everything eases or springs. Both stop simulating under reduced motion or when unseen (behind a closed door, or on an open one) and hold a still pose.

### Recipes
"Find recipes" shows the best matches. "Find again" sends the recipes already shown (`seen`) and a new random `seed`: unseen recipes come first, close calls are reshuffled, and the rotation starts over once everything has been seen. Pages keep the same seed, so going back shows the same recipes.

Rules: one meaning per effect (cobwebs never mean anything but "forgotten"). Effects never cover the name, the days-left text or the stage icon. Mould and decay use the stage hues, so freshness stays the only colourful system. Implementation: `components/fridge/haunt-effects.tsx`, `lib/domain/haunt.ts`, `components/graveyard/graveyard-scene.tsx`.

## Item types and tiles
- An item's photo is the main picture. Until there is one, the tile shows a line icon for its type (`CATEGORY_ICON`): Vegetable (carrot), Fruit (apple), Herbs (leaf), Mixed produce (salad), plus the other types. The type is picked on the review screen and can be changed in item details; Gemini is asked for vegetable / fruit / herbs rather than mixed produce.
- Tiles stretch to share a shelf row's spare width (up to 1.5× their base width) so names truncate less.

## Fridge screen order and counts
- The "Needs attention" card sits above the cabinet. Its rows are short ("2 spoiled" / "2 dates to check", then the item names) so the button stays on the same row at 320 px.
- At ≥ 1024 px "Cook this tonight" sits under the pantry, filling the space beside the taller fridge; below that it follows the cabinet. The Week card comes last.
- The freshness key opens from an info button at the end of the chip row (pinned at the right on phones while the chips scroll).
- On the fridge screen at ≥ 1280 px the top-bar badge (and "Summon recipes") step aside for the "Haunting now" panel, which carries the count, grouped by stage (Spoiled, Rotting, Expiring) with the stage colour on the group heading, not on every row.
- Offline: a warning-tinted "Offline" pill in the top bar (icon-only on phones) opens Settings. The full offline banner shows only on screens whose job needs the server (Scan, Review, Recipes; `Screen needsServer`). 
- Tile names take up to two lines when they contain a space; a single long word stays on one line with an ellipsis rather than splitting mid-word.
- Phones: "Add item" is icon-only beside the title; the filter chip row fades at its right edge while more chips are off-screen; toasts on the fridge screen sit above the "Add by photo" button.

## Page scaffolding (all screens)
- `Screen` puts the `h1` and the page actions on one row and the description full width beneath, so a button never squeezes the description into a narrow column.
- Empty states inside a card use `EmptyState inCard` (no dashed outline: the card already has a border). Standalone empty states keep the dashed outline.
- Side-by-side cards use `flex-1` only in a row; in a phone's column it forces equal heights and overflows content.
- Scan: the receipt card comes first and carries the primary button; single-item photos second; "No photo? Enter items by hand" below both. Side by side from `md`. Copy says what happens ("We read the items and prices"), not which engine does it; the Gemini privacy notices stay as they are.
- Review (typed by hand): the currency is "Prices in", typed rows show no confidence score, and the header bar has only a back button (the `h1` names the screen). Phone footer: total on its own line, then Cancel and a full-width Confirm.
- Recipes: the diet filter is collapsed to its current value with "Change"; Settings shows every chip. "Find recipes" is disabled while the server is unreachable, and the screen rechecks the server every 20 s until it's back.
- Graveyard: stone headroom scales continuously with money lost (12–96 px, computed, the one sanctioned exception to the spacing scale because it encodes data), stones stand on an earth strip, fog fades in from clear at the top, and the plot is at least `min-h-96` from `md`.

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
