# Ghost Kitchen: pitch, demo and video plan

## In one line
A haunted pixel-art kitchen that shows you which food is about to go off, helps you cook it first, and tells you what you saved in money and CO₂.

## The problem
- Households wasted over **1 billion meals a day** in 2022. Of the **1.05 billion tonnes** of food wasted, **60%** was at home, not in shops or restaurants (UNEP Food Waste Index Report 2024).
- Food loss and waste produce **8–10% of global greenhouse gas emissions**, almost five times aviation (same report).
- Most of it is food people already paid for and forgot about. Inventory apps fail because logging is a chore, so the app stops matching the real fridge within a week.

## Who it's for
A household that wants to waste less and feels it in money: someone doing a weekly shop, cooking most evenings, sharing a fridge with others.

## What's different
- **Logging is nearly free.** One receipt photo stocks the fridge (Tesseract OCR, then Gemini), a single photo or barcode covers food without one, and you can tell the fridge "used half the milk and two eggs" by voice.
- **The fridge nags in a way people like.** Doors stand ajar when food behind them is turning, ghosts peek out, and poking one opens the most urgent food. Every spooky effect means exactly one state, and the same fact is always in words for screen readers.
- **AI that can't make people ill.** Gemini supplies facts, but rules on the server and the device set floors it can't move: meat, fish, dairy, eggs and leftovers are always high risk and never stored in the pantry; spoiled food is never put in a recipe; diet filters fail closed; estimates lean short and stay marked "est." until checked.
- **Waste you can measure.** The ledger shows money spent, rescued and wasted, and the CO₂ and water behind it, using Poore & Nemecek (2018) per-kg footprints from Our World in Data.
- **Free to run.** Docker, Postgres, Tesseract, the Gemini free tier, TheMealDB and Frankfurter. The whole server fits in under 1 GB of RAM limits. One React Native codebase is the web app and the Android app.

## Links for judges
- **Web demo:** `https://<your-host>/?tour=1`. It loads a sample fridge, turns on demo mode (recorded answers, no server or internet needed) and starts the 8-stop guided tour.
- **Android APK:** QR code to the EAS preview build (see "Still to do").

## Impact slide
Use the app's own sample week, as shown in the ledger in demo mode, next to the UNEP figures above. Take the numbers from the screen on the day you record, so they match the video.
- Money rescued vs thrown away this month, and the rescue bar.
- CO₂e and water kept out of the bin, with the "driving N km" comparison.
- Four constraints met: free services only, under 4 GB RAM, web and Android from one codebase, works offline in demo mode.

## 90-second video (record in demo mode, following the tour)
| Time | Show | Say |
|---|---|---|
| 0–10 s | The kitchen at night, a door ajar, a ghost peeking | "60% of food waste happens at home. This fridge won't let you forget." |
| 10–25 s | Scan → **Use the sample receipt** → review | "One photo stocks the fridge. It flags what you already have and what it isn't sure of." |
| 25–35 s | Confirm; doors rattle; poke a ghost, it opens the most urgent food | "The ghosts lead you to what's about to turn." |
| 35–45 s | **Tell the fridge**: "used half the milk and two eggs" | "Logging takes a sentence." |
| 45–60 s | Recipes, then **Plan the next 3 days** | "It plans meals around what's turning. Never spoiled food, never meat past its date." |
| 60–75 s | Ledger: count-up, CO₂, badges; **Share my week** picture | "You see what you saved, in money and CO₂." |
| 75–90 s | "How dates are decided" screen, then the wordmark | "Rules the AI can't bend. Free to run, web and Android. Ghost Kitchen." |

Record the web app with the browser at a phone size (390 × 844), or the Android build with screen recording. Turn sounds on; the door, rescue and burial sounds carry the mood.

## How Kiro was used
Everything below is in the repo, so judges can check it.
- **Steering** (`.kiro/steering`): `tech.md` sets the hard constraints (free resources only, 4 GB RAM, web and Android from one codebase, the Gemini key stays on the server); `food-safety.md` sets the safety floors and says they must never be weakened to make a feature easier; `design.md` loads `docs/design-contract.md` whenever a `.tsx` file is touched, so every screen follows the same pixel-art and accessibility rules; `frontend-ui-engineering` is a skill for UI quality.
- **Hooks** (`.kiro/hooks`): typecheck and test the API on save; typecheck the app on save; rerun the demo-data cross-checks when recorded data changes; and an **agent hook** that reviews every save to a food-safety file (expiry, storage, products, recipes, surplus offers, voice logging, the 3-day planner, demo product facts) against the steering rules.
- **Strategy:** the AI does the work it's good at (reading receipts, naming products, parsing free-form sentences, estimating shelf life), and deterministic code with tests sets the limits. Steering made those limits part of every change, and the agent hook checks them.

## Still to do (needs your accounts)
1. **Host the web app.** `docker compose up -d --build`, then a free Cloudflare Tunnel to port 3000. Share `https://<tunnel>/?tour=1`.
2. **Build the APK.** `cd apps/mobile && npx eas-cli build -p android --profile preview`; put the download link in a QR code on the last slide.
3. **Record the video** using the shot list above, then check `docs/android-checklist.md` on a real phone (voice, sharing a picture, sounds, the night shading).
