# Design Contract: Ghost Kitchen client (web + Android)

Applies the frontend-ui-engineering skill. Implementation: `apps/mobile` (Expo SDK 57, React Native 0.86, Expo Router, React Native Reusables (shadcn/ui port), NativeWind 4). Tokens live in `apps/mobile/global.css` and `tailwind.config.js`; `lib/theme.ts` mirrors them for navigation.

Implementation notes:
- Chips use `components/common/filter-chip.tsx`, not the Reusables `Toggle`: `Toggle` forwards its className into `TextClassContext`, which leaks container styles onto child text.
- Sheets use `components/common/responsive-sheet.tsx` (RN `Modal`), so the Android back button closes them.

## References and assumptions
No external reference catalogue was supplied. Decisions below are drawn from common patterns in inventory and pantry apps (dense item grids, status filters, bottom-sheet details on mobile) and from the earlier HTML prototype. They should be checked against real screens when references are available.

## Visual language
- **Theme:** dark only. A night-time kitchen lit by the fridge lamp. Background is a near-black with a faint purple tint (`268 20% 7%`), taken from the Icons8 "Halloween UI kit" on Figma Community; surfaces step up in lightness, not with shadows.
- **Accent:** one flat mint primary (`155 87% 59%`, the kit's mint) for the main action per screen. No gradients on controls. Purple appears only as a surface tint (background, `accent` for hover and selected rows); it is never a button, link or brand colour.
- **Freshness is the only colourful system.** Five stage tokens: `--stage-fresh`, `--stage-aging`, `--stage-expiring` (pumpkin), `--stage-rotting` (the kit's lavender), `--stage-spoiled`. Every stage is shown with colour, an icon (Sprout, Hourglass, Flame, Bug, Ghost) and a text label, never colour alone. Every token is at least 4.5:1 against the background and cards.
- **Haunting effects** live on fridge food tiles, compartment lamps and the graveyard scene only (see "Costume layer" below). All are stilled by `prefers-reduced-motion` or the in-app setting.
- **Radius:** shadcn scale from `--radius: 0.5rem`. Cards `rounded-lg`, chips/badges `rounded-full`, fridge cabinet `rounded-xl`. No `rounded-2xl+` elsewhere.
- **Spacing:** Tailwind 0.25rem scale only. No arbitrary pixel values.
- **Type:** three faces, after the Icons8 Halloween UI kit. System font (Roboto on Android) for all body and UI text. Bricolage Grotesque Bold (`font-heading`, OFL) for page `h1`s (`text-2xl`) and card titles. Mountains of Christmas Bold (`font-display`, Apache-2.0) only for the wordmark, the graveyard's title and tombstone engravings (`<Screen display>`), never on working screens or for anything people need to read at length. Custom faces carry no `font-bold` class: on Android a weight on a custom family can fall back to the system font. Until a face loads, the system font is shown. One `h1` per page, `h2` per section; numbers use `tabular-nums`.
- **Icons:** Lucide line icons, plus a few from Lucide Lab (ISC, `components/halloween/lab-icons.ts`): `Pumpkin` means "Haunting" (expiring + rotting + spoiled; `Flame` alone means expiring), `Cauldron` is Recipes, `Dust` is forgotten food (matching the dust on forgotten tiles), and Lucide's `Tombstone` is the Graveyard. The five stage icons don't change.
- **Illustrations:** flat Microsoft Fluent Emoji (MIT, `components/halloween/art.tsx`, fetched by `scripts/fetch-halloween-art.mjs`), always decorative (`aria-hidden`) and beside words that say the same thing. Used only for the wordmark ghost, the Scan title (pumpkin), first-seen empty states (empty fridge: ghost; no graves: headstone; no recipes fit: crystal ball; nothing urgent: candle) and the graveyard's moon and bats. Never for food or controls. The Icons8 kit's own assets are not used (their free licence needs a visible credit link, and they can't be downloaded without a Figma login).

## Accounts
Details and setup: `docs/accounts.md`.
- **Sign-in screen** (`components/auth/sign-in-screen.tsx`): one pixel card with the ghost, the wordmark, **Continue with Google** (primary), then email and **Email me a code**; the code step has a 6-digit field, **Sign in** (or **Make my account** for a new email), **Send a new code** and **Use a different email**. Errors are one plain line under the buttons (`role="alert"`). No passwords.
- **Gate** (`components/auth/auth-gate.tsx`): required when the server reports a Clerk key. Before the first status check it shows a loading ghost; an unreachable server gets "Can't reach your server" with a retry (and, on Android, the server address).
- **Signed in:** the person's ghost avatar sits at the end of the top bar and opens **Your profile**. A lapsed session shows a warning-tinted **Sign in to sync** pill; the fridge stays usable.
- **Profile** (`app/profile.tsx`): name, ghost and colour pickers (radio groups, 44 px), "Your record" (ghosts banished, saved, buried, quiet weeks), badges with progress ("3 of 10", locked ones dimmed, the state also in words), who shares the kitchen (owner can remove), sign out and delete account (both confirmed).
- Settings starts with an **Account** card when signed in; the server's access token field is hidden then, since sign-in protects the server.

## Pixel-art layer
Every surface is pixel art. It changes shape and type, not meaning: the colour system, stage icons and labels are unchanged.
- **Type:** VT323 (OFL, `apps/mobile/assets/fonts`) for all text by default (`font-pixel`, set in `components/ui/text.tsx` and `input.tsx`); its digits can't be confused, which matters for dates. `font-heading` (card titles) is VT323 too. Pixelify Sans (OFL, `font-display`) only for page titles, the wordmark and the graveyard, which are words: its 2 and 5 read as 8 and S. The font-size scale in `tailwind.config.js` is bumped because VT323 draws small.
- **Icons:** `Icon` swaps every Lucide icon for a pixel version (`components/ui/pixel-icons.ts`, built by `scripts/make-pixel-icons.py`): Pixelarticons (MIT) where one exists, hand-drawn 12-cell grids for the rest (ghost, fridge, tombstone, pumpkin, cauldron, web, sprout and the food icons).
- **Illustrations:** 16 px colour pixel sprites (`assets/sprites/art`), same rules as before (decorative, beside words).
- **Corners and depth:** every radius is 0. Cards, chips and inputs have 2 px borders; cards, chips and filled buttons have a thicker bottom edge that halves when pressed. No soft shadows.
- **Gradients** are drawn as 6 hard colour bands (`components/fridge/gradient.tsx`).
- **Motion** in pixel effects is stepped (frames or fixed levels on a timer), not tweened.
- **Ghosts:** pixel sprites from `assets/sprites/ghosts` (5 variants; a spoiled item always gets the same one), moved by the physics in `ghost.tsx`.
- **Kitchen sprites** are graded by `scripts/spookify-sprites.py` (dim enamel, murky insides, cobwebs, slime, claw marks, rust, red eyes in the pantry) and also makes each door's ajar frame (`<zone>-ajar.png`, between the pack's shut frame and frame 1): a 4 px crack at the door edge showing the lit inside, the door beside it slid over by dropping plain columns, with its marks moved along. `scripts/make-pixel-assets.py` builds the rest (both doors ajar, the light through each crack, wall tiles, tile overlays). A door with haunting food rests on the ajar frame and opens and closes from it, and its light (`light-<zone>-<frame>.png`, one per frame) stays on through the whole swing and the zoom, lighting whatever the door has uncovered: the inside of the body and, once the door swings out, the inside of the door (its shelves and lining), but not its outer frame. Atmosphere marks carry no meaning; the door chips carry the counts.
- **Open compartments** are pixel frames in the graded palette (`PIXEL` in `lib/theme.ts`): outline, bevel, tiled back wall, pixel shelves with a dithered shadow.

- **Food photos** on shelf tiles are shown as 16-cell pixel art, made on demand in memory (`lib/pixel-photo.ts`); the item sheet keeps the full photo. On Android it's a soft mosaic, because React Native has no nearest-neighbour scaling.
- **Scene loops:** a slime drop falls from the freezer seam now and then, red eyes blink in an ajar pantry's crack (hidden while its ghost is out), and tile cobwebs sway a pixel. Atmosphere only.
- **Poking a ghost:** while a ghost is well out of its door, tapping it plays a "boo" and opens the most urgent item behind that door. A pointer and touch shortcut (out of the tab order and hidden from screen readers). Screen readers get the same as a custom action on the door ("Show the most urgent food"), and on web, pressing U on a focused door does it.
- **Sounds** are spooky 8-bit (`scripts/make-pixel-sounds.mjs`): diminished and tritone intervals, falling chromatic lines, a stepped vibrato, two slightly detuned voices, a breath of noise and an echo tail. Door open and close per section, burying, and the ghost. "Sounds and vibration" in Settings turns them off.
- **One clock** (`onTick` in `pixel-effects.tsx`) drives every stepped effect, so a full fridge runs one timer, not dozens. Only the sprites on screen stay mounted, plus every frame of a door that's moving or that the pointer is on.
- **Larger text** (Settings → Sound, motion and text): every size class one step up the scale (`lib/text-scale.ts`, applied in `Text` and `Input`); fixed line heights are dropped so nothing clips.
- **Housemates' changes:** when household sync brings a change to the food in a section, that door rattles to its crack for 1.6 s and its ghost looks out (`lib/store/kitchen-pulse.ts`).
- **Open door:** on wide screens an open compartment shows its door swung out beside the shelves, its inside lit while anything in there is turning.
- **Loading and toasts:** skeletons are dithered blocks that blink in two steps; toasts and sheets have the 2 px pixel frame. A toast can carry one button (e.g. "Add to list" after binning or burying food, which puts it on the shopping list).
- **Ghosts banished:** the week card counts food used while it was turning as ghosts banished, with a pixel trophy.
- **Notification text** is spooky but leads with the facts ("Milk is starting to turn", "3 things are stirring in your kitchen ... need cooking soon").
- **Android notification icon:** a white pixel silhouette of the ajar fridge with a ghost (`assets/images/notification-icon.png`).

- **Names that fit** (`lib/text-fit.ts`): tile names and tombstone names take the largest size at which every word fits (measured: VT323 0.40 em, Pixelify Sans ~0.64 em), and a word that fits no size is hyphenated between consonants ("Mush-rooms", "Strawber-ries"), never cut off or split at random. Tile dates past 99 days show in months ("5mo left"). Ligatures are off, because Pixelify Sans draws "fi" like an "A".
- **Stage glyphs:** the corner badge on a tile is an 8 × 8 glyph at 16 px (`components/stage/stage-glyph.tsx`), so every art pixel is 2 screen pixels and the five stages are told apart at a glance.
- **Phones:** the door labels sit in a strip under the kitchen scene instead of over the art; search folds into an icon beside **+** (it opens a field, and stays open while there's a search), and the two view buttons become one toggle. Wide screens keep the labels beside the doors and the search field.
- **Open compartment:** tabs (Fridge, Freezer, Pantry, each in its own colours, with counts) switch compartments without closing; the first spare shelf says "Room for more".
- **Floating surfaces** (dialogs, sheets, dropdowns, popovers, the hover card) share one pixel frame: 2 px border, lit top edge, dark 4 px bottom edge, and on web a hard offset shadow. Dropdown options highlight as a solid block. The welcome sheet has pixel step pips.
- **Buttons and chips** press in: the face sinks 2 px (a translate, so nothing moves) and the colour steps darker. A chip that's on stays pressed in.
- **Type scale:** the two smallest steps are a pixel bigger (xs 16 px, sm 18 px), and the bottom-nav labels use sm.
- **Rewards** (`components/common/celebration.tsx`): using food that was turning shows its ghost rising away in stepped frames with "Ghost banished!"; earning a badge pops its picture up for a moment and then a toast names it. Only for your own action (one new history entry, yours). Decorative, since the toasts say the same, and skipped under reduced motion.
- **Motion in the UI** (`components/common/pixel-motion.tsx`): a few stepped motions on the shared clock, never tweens, all held still under reduced motion and none carrying meaning on its own. Screens rise into place (4 frames) each time you come to them, without remounting; recipe cards deal in one by one; the selected tab's icon hops; decorative art in empty states and the tour card floats a couple of pixels.
- **Guided tour** (`components/onboarding/tour-card.tsx`, stops in `lib/domain/tour.ts`): a pixel-framed card under the top bar, never modal and never moving focus; its title is announced. It folds to a "Tour N of 8" pill. Stops that ask for an action move on when the user does it. Started from `/?tour=1` or Settings → Demo mode.
- **Tell the fridge** (`components/fridge/voice-sheet.tsx`): a microphone button beside the fridge title opens a sheet; speech or typed text becomes a checklist of "Used…" / "Bury…" lines, each untickable, applied only on Confirm. Lines with a guessed amount say so; food past its date says to check the food itself.

## Costume layer
The spooky design must carry information. Every effect stands for one state, is decorative to assistive tech (`aria-hidden`), and the same fact is always given in words, in the item's label or on screen. Under reduced motion each effect becomes a still frame that still reads.

| Effect | Means | Where | In words |
|---|---|---|---|
| Dithered yellow over the photo | Aging | Food tile | Stage label |
| Blinking ember edge + pixel flames along the photo's bottom | Expiring | Food tile | Stage label, days left |
| Pixel mould (more the longer it's over) + flies + small cobweb | Rotting | Food tile | Stage label, "2d over" |
| Big cobweb + ghost rising out of the food | Spoiled | Food tile | Stage label; "N spirits in here" on the compartment |
| Dust over the photo | Forgotten: full and untouched for 3+ weeks (`FORGOTTEN_DAYS`) | Food tile | "untouched for 4 weeks" in the tile label |
| Lamp stutters often, cold light (it stutters rarely otherwise) | Something in this compartment has spoiled | Open freezer / fridge | "N spirits in here" + group label "N spoiled" |
| Door stands ajar, sickly light flickering through the crack, a ghost peeking out now and then | Something behind it is expiring, rotting or spoiled (haunting) | Kitchen scene | "N haunting" on the door's chip; the door label lists stages |
| Tombstone height | Money lost on that item, relative to the costliest grave | Graveyard | Amount on the stone + "The bigger the stone…" |
| Moon, bats, drifting fog, leaning stones | Atmosphere only | Graveyard | — |
| Stepped indigo dusk (19:00–22:00 and 05:00–07:00), darker night with a moon (22:00–05:00), by the device clock | Atmosphere only | Kitchen scene | — |
| A bat flapping across the top tenth of the scene every 20–40 s | Atmosphere only (night) | Kitchen scene | — |
| A tile drops onto the shelf with a small bounce | Food that just arrived: added here, or by someone sharing the kitchen | Shelves, the use-first list | The item is there with its name; your own adds also get a toast |
| The pumpkin badge swells in steps | The haunting count just changed | Top bar | The number itself |
| A low groan, a heavy haptic, a red-tinted screen and a stepped shake with a headstone | Food just spoiled while the app was open (never on launch) | Whole screen, once per item | Toast names the food and says to bury it |
| A rising chiptune arpeggio and a success haptic | Food used while it was turning (rescued) | With "Ghost banished!" | The action's own toast |

### Kitchen scene (sprites)
The kitchen view opens on a pixel-art scene (`components/fridge/kitchen-scene.tsx`, sprites in `assets/sprites/kitchen`, from the "Pixel Art Fridge Pack", Fridge 4 white; check its licence before shipping): the fridge-freezer on the left, the pantry on the right. Freezer, fridge and pantry are three hit areas of at least 44 px, each with a label chip (name, count, "N spirits") and the same spoken door label as before.
- Open: the sprite plays frames 0 to 4 (110 ms each), the scene zooms until that door fills almost the whole window (480 ms, drawn in a full-window overlay over the nav bars), then the open compartment takes over the whole page (`open-compartment.tsx`): the sprite's flat colours (`PIXEL` in `lib/theme.ts`: grey-green body and murky teal inside for the fridge and freezer, dark wood for the pantry) with its dark outline, shelves scrolling inside, and a Close button (focus moves to it; Android back also closes). Close: the scene fades back at full zoom, zooms out, plays frames 4 to 0, and focus returns to the door.
- One door is open at a time. Reduced motion skips the animation and zoom.
- Search and stage filters no longer open doors; the chips show "N matches" instead. A new search or filter while inside returns to the scene.

### Ghost motion
Ghosts are small physics bodies stepped every frame (`useFrameCallback`, `components/fridge/ghost.tsx`), each with its own randomness so no two move alike. Two layers:
- Movement. Rising (spoiled tile): pulsing buoyancy against air drag, a smoothly wandering breeze with the odd gust, held over the food by a soft spring; it materialises (fades in and swells), thins out near the top and re-forms after a random pause. Peeking (ajar door, kitchen scene): steps out a sprite pixel at a time from behind the door edge, lingers, sometimes only half out, and slips back.
- Shape (`LivingGhost`, an SVG redrawn every frame). The hem ripples faster and deeper with speed and trails behind sideways motion on its own spring. It leans and squashes or stretches on springs, the eyes look where it's heading, it blinks at random (sometimes twice), and the mouth opens as it speeds up.
- No value jumps: everything eases or springs. Both stop simulating under reduced motion or when unseen (behind a closed door, or on an open one) and hold a still pose.

### Recipes
"Find recipes" shows the best matches. "Find again" sends the recipes already shown (`seen`) and a new random `seed`: unseen recipes come first, close calls are reshuffled, and the rotation starts over once everything has been seen. Pages keep the same seed, so going back shows the same recipes.

Rules: one meaning per effect (on food tiles, cobwebs mean rotting or spoiled and dust means forgotten). Effects never cover the name, the days-left text or the stage icon. Mould and decay use the stage hues, so freshness stays the only colourful system. Implementation: `components/fridge/haunt-effects.tsx`, `lib/domain/haunt.ts`, `components/graveyard/graveyard-scene.tsx`.

## Item types and tiles
- An item's photo is the main picture. Until there is one, the tile shows a line icon for its type (`CATEGORY_ICON`): Vegetable (carrot), Fruit (apple), Herbs (leaf), Mixed produce (salad), plus the other types. The type is picked on the review screen and can be changed in item details; Gemini is asked for vegetable / fruit / herbs rather than mixed produce.
- Tiles are 56 px wide on phones (80 px from `md`), with an 8 px gap, so a 320 px phone fits four per shelf.
- Tiles stretch to share a shelf row's spare width (up to 1.5× their base width) so names truncate less.
- The date line under the name is always one row, so every tile on a shelf is the same height: "5d left" when the date is confirmed, "5d est." while it's an estimate ("5mo", "today", "2d over" the same way). It steps the font down a size before it would wrap.

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
- Review: each food row has a **Store in** picker (Fridge, Freezer, Pantry). It offers only sections that food keeps in, never the pantry for high-risk food; changing it re-estimates the date, which must be confirmed again unless the user typed it or it came off the pack.
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
- `< md (768px)`, which includes Android: top app bar, bottom navigation (5 items: Fridge, Scan, Recipes, Plan, Ledger; 48dp targets; Settings in the top bar, Graveyard from the Ledger). Adding food has one home, the Scan tab (the fridge's "+" goes there); there is no floating button covering content. Details, pickers and confirmations open in a bottom **Drawer**. Fridge zones stack and the door becomes a horizontal shelf.
- `md`–`lg`: left navigation rail. Details open in a right **Sheet**. Dialogs for confirmations.
- `≥ xl (1280px)`: a persistent right "Haunting now" panel lists at-risk items.
- Mouse or trackpad on web (`useCanHover`, any width): resting on a food tile for 500 ms opens a small hover card (224 px wide, above the tile; it never takes the pointer and closes the moment the pointer leaves) summarising its stage, what that means, the date, amount left and value. It is a shortcut only (everything in it is also in the tile label and details), never on touch or Android, and clicking the tile dismisses it.
- Recipes: 10 per page, with page numbers under the list (compact "1 … 5 6" beyond 5 pages, so it fits 320px).
- Check at 320, 768, 1024 and 1440px.

## URL state
`/fridge?stage=expiring&q=milk&item=<id>`. Filters, search and the open item live in the URL, so they can be shared and so the Android back button (history) closes the detail drawer.

## Patterns to reject
Stock 3-up card grids for the fridge, hero banners, gradient buttons, glassmorphism, shadow stacks, emoji or illustrations for food (food is shown with the user's own photos; items without one get a neutral line icon), colour-only status, spinners where skeletons fit, modals on mobile when a drawer works.

### Keeping the fridge true
Logging must be quick or the fridge stops matching the real one.
- An item's sheet reads top to bottom: a compact header (small photo, stage, days left, camera button), a facts row (Left · Worth · Expires), then **Used it all** and **Binned it** (`quick-actions.tsx`), then one advice line; partial use, dates and moving by hand follow below. The sheet title is the name, so it isn't repeated.
- Press and hold a fridge tile for the same two actions without opening the sheet (`quick-sheet.tsx`). Screen readers get it as a custom action.
- The fridge can also be shown as a **use-first list** (`use-first-list.tsx`, remembered in `settings.fridgeView`): rows grouped by stage, most urgent first; swipe right for used, left for binned, with buttons on each row doing the same.
- The attention card, above the fridge, shows only the most urgent decision; the rest fold under "N more to do". One short line each: spoiled food to bury; **Freeze X** for expiring, freezable food (or "Move X to the fridge", `lib/domain/suggest.ts`, which uses the same safety rules as moving by hand); dates to check once food starts to turn; and **Still have these?** for food untouched for weeks.
- **Text:** at most one line of supporting text per row or card. Explanations belong in the item sheet.
- **Food icons:** without a photo, a food shows an icon for what it is, from its name (`food-icon.ts`: apple, cherry, leafy green, drumstick…), falling back to its category. Tiles don't carry an amount badge; amounts are in the hover card, the list and the sheet.
- **Sets of food** (Recipes, Plan) are one line, `ItemsLine`: the most urgent few as small photos and names, then "+N", with the stage colour once. No walls of coloured pills.
- **Recipes** load on their own when food is turning; the best match sits on top as "Tonight", open.
- **Ledger:** one hero number (wasted in the last 30 days, with the trend against the 30 days before), a rescue bar and a small Spent · Saved · At risk row.
- Stages follow the calendar: the app re-renders when the date turns (`lib/store/clock.ts`).
- The weekly digest lives on the Ledger, not the fridge screen.
