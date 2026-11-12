# Software Requirements Specification: Ghost Kitchen Inventory

Version 0.1 (MVP) | Date: 2026-11-10

## 1. Introduction

### 1.1 Purpose
This document defines the requirements for Ghost Kitchen Inventory, an application that turns grocery receipts and pantry photos into a tracked inventory, estimates spoilage risk, and generates recipes that use food closest to expiring.

### 1.2 Pitch
"Turn grocery receipts and a messy fridge into meals before the food becomes a graveyard."

### 1.3 Scope
The MVP lets a user upload a receipt, extract items and prices, confirm them manually, see them in a virtual fridge with freshness stages, generate three recipes prioritizing expiring items, and view savings and waste avoided. Photo-based pantry recognition is post-MVP (see 2.4).

### 1.4 Definitions
| Term | Meaning |
|---|---|
| Haunt | An item in the Expiring or Rotting stage that needs attention |
| Graveyard | History of items that were spoiled and discarded |
| Laid to rest | An item marked as used (consumed in a recipe or otherwise) |
| Freshness stage | Discrete state derived from remaining shelf life |
| Waste avoided | Estimated value of items used before spoiling |

## 2. Overall Description

### 2.1 Product Perspective
A cross-platform product delivered as a responsive **web app** and a native-packaged **Android app**, built from one shared codebase. Both clients use the same backend API, OCR service, expiry engine, and Gemini-based recipe generator, and share one user account and inventory.

### 2.2 User Classes
- Home cook / household shopper (primary): wants fewer wasted groceries and lower spend.
- Student / budget-limited user: cares about cost per meal and savings.

### 2.3 Operating Environment
- Web: modern browsers (Chrome, Safari, Firefox, Edge, last 2 versions), desktop and mobile layouts.
- Android: Android 8.0 (API 26) and above, phones and small tablets, distributed as an APK/AAB (Google Play).
- iOS native app is not part of the MVP; iOS users can use the web app.

### 2.4 Out of Scope for MVP
- Pantry photo recognition (computer vision)
- Barcode scanning
- Multi-user households and sharing
- Store-specific receipt templates beyond generic OCR
- Native iOS app
- Full offline editing with conflict resolution (Android has read-only offline cache only)

### 2.4.1 Platform Feature Matrix
| Capability | Web | Android |
|---|---|---|
| Receipt upload from file | Yes | Yes (gallery/files) |
| Receipt capture with camera | Yes (browser camera/file capture) | Yes (native camera, document crop) |
| Fridge, recipes, ledger, graveyard | Yes | Yes |
| Expiry reminders | In-app banner | Local notifications (daily digest and per-item) |
| Offline viewing of fridge | Cached, best effort | Cached inventory, read-only |
| Share recipe | Web Share / copy link | Native share sheet |
| Install | Open in browser | Native app: APK (EAS preview build) or Play Store |

### 2.5 Assumptions and Constraints
- Receipts may be in any currency; the system detects it automatically (see 4.6.0). Receipt text is primarily English for MVP, though Gemini handles other languages on a best-effort basis.
- Shelf-life data comes from a curated default table, not per-product labels.
- AI features (receipt reading, recipes) use the Google Gemini API free tier (`gemini-3.5-flash`) and need network access from the server. Free-tier quotas are limited, so the system falls back to local OCR and recipe templates when they run out.
- Food-safety guidance is advisory, not medical advice.

## 3. Freshness Stages

Stage is computed from `daysRemaining = expiryDate - today` relative to the item's `totalShelfLifeDays`.

| Stage | Name | Rule | Visual |
|---|---|---|---|
| 1 | Fresh | remaining > 50% of shelf life | Green, normal |
| 2 | Aging | 25% < remaining <= 50% | Yellow-green |
| 3 | Expiring | 0 < remaining <= 25% or <= 2 days | Orange glow, "haunt" badge |
| 4 | Rotting | expired 0-3 days ago | Purple/sickly, flies, dripping |
| 5 | Spoiled | expired more than 3 days ago | Grey ghost, move to graveyard prompt |

Rotting and Spoiled thresholds may be overridden by category rules (e.g. dairy, meat are stricter; see FR-EXP-5).

## 4. Functional Requirements

Priority: M = Must (MVP), S = Should, C = Could.

### 4.1 Receipt Upload and OCR
| ID | Requirement | Pri |
|---|---|---|
| FR-RCP-1 | The user shall upload a receipt image (JPG, PNG, HEIC) up to 10 MB via file picker or camera. | M |
| FR-RCP-2 | The system shall extract line items with name, quantity, and price. | M |
| FR-RCP-3 | The system shall extract store name, date, currency, subtotal, tax, and total when present. | S |
| FR-RCP-4 | The system shall display processing status (uploading, reading, parsing, done, failed). | M |
| FR-RCP-5 | On OCR failure or zero items, the system shall offer retry and manual entry. | M |
| FR-RCP-6 | The system shall ignore non-food lines (bags, tax, discounts) where detectable and flag uncertain lines. | S |

### 4.2 Item Confirmation
| ID | Requirement | Pri |
|---|---|---|
| FR-CNF-1 | The user shall review all extracted items in an editable list before they enter inventory. | M |
| FR-CNF-2 | The user shall edit name, quantity, price, category, purchase date, and the receipt currency, and delete or add rows. | M |
| FR-CNF-3 | The system shall show OCR confidence per row and highlight low-confidence rows. | S |
| FR-CNF-4 | The system shall normalize cryptic receipt text (e.g. "ORG BNLS CHKN BRST") to a canonical ingredient. | M |
| FR-CNF-5 | Nothing shall be added to inventory until the user confirms. | M |
| FR-CNF-6 | The system shall warn on likely duplicates of existing inventory items. | C |

### 4.3 Inventory (The Fridge)
| ID | Requirement | Pri |
|---|---|---|
| FR-INV-1 | The system shall render a virtual fridge showing every current item placed in zones (shelves, drawers, freezer, door, pantry) based on category. | M |
| FR-INV-2 | Each item shall display its freshness stage visually (color, animation, badge). | M |
| FR-INV-3 | Selecting an item shall show details: photo, name, quantity, price, purchase date, expiry date (estimated or confirmed), days remaining, stage. | M |
| FR-INV-4 | The user shall mark an item "laid to rest" (used), "partially used", or "discarded (spoiled)". | M |
| FR-INV-5 | The user shall filter by stage and search by name. | S |
| FR-INV-6 | The user shall manually add items and edit expiry dates. | M |
| FR-INV-7 | Expiring and rotting items shall be visually emphasized (glow, haunt badge) and summarized in a counter. | M |
| FR-INV-8 | Discarded items shall move to the Graveyard with their lost value. | S |
| FR-INV-9 | Stage shall be recalculated at least once per day and on app open. | M |

### 4.4 Expiry Estimation
| ID | Requirement | Pri |
|---|---|---|
| FR-EXP-1 | The system shall estimate expiry as purchase date + default shelf life for the ingredient and storage location. | M |
| FR-EXP-2 | The user shall override the estimated expiry date. | M |
| FR-EXP-3 | The system shall support storage location (fridge, freezer, pantry) affecting shelf life. | S |
| FR-EXP-4 | Each estimate shall carry a source tag (default table, user, model estimate). | S |
| FR-EXP-5 | Food-safety rules shall be applied: raw meat, fish, and dairy shall never be shown as "Fresh" past their safe window, and the app shall advise discarding rotting high-risk items rather than cooking them. | M |
| FR-EXP-6 | Unknown ingredients shall get a conservative model-estimated shelf life flagged as low confidence. | S |
| FR-EXP-7 | During review, every food line shall show its estimated expiry date. Confirming or adjusting a date is optional and never blocks stocking the fridge; unconfirmed dates stay marked "est." and are flagged in the fridge until checked. Adjusting a date counts as confirming it. A bulk "confirm remaining" action shall list every item and date before applying. | M |
| FR-EXP-8 | Items whose expiry is still an estimate shall be marked in the fridge ("est.") and in item details, with a prompt to check the package and confirm. | M |

### 4.4.1 Food Photos
| ID | Requirement | Pri |
|---|---|---|
| FR-PHO-1 | The user shall take a photo of each food item (or pick one from the gallery), either during receipt review or later from item details, and retake it at any time. | M |
| FR-PHO-2 | The fridge, item details, recipes, ledger and graveyard shall show the user's own photo of each item. Items without a photo shall show a neutral category icon, not an illustration. | M |
| FR-PHO-3 | Photos shall be stored small (about 480 px, JPEG) and kept privately on the device until sync; they shall not be sent to Gemini. | M |
| FR-PHO-4 | Freshness stage shall remain readable on photos through border, badge, label and a tint on rotting or spoiled items. | M |

### 4.5 Recipe Generation
| ID | Requirement | Pri |
|---|---|---|
| FR-REC-1 | The system shall generate exactly three recipes on request. | M |
| FR-REC-2 | Recipes shall prioritize ingredients in Expiring (and Aging) stages, weighted by urgency. | M |
| FR-REC-3 | Recipes shall not include Rotting or Spoiled high-risk items. | M |
| FR-REC-4 | Each recipe shall list title, time, servings, ingredients (marked in-stock / missing), steps, and which expiring items it saves. | M |
| FR-REC-5 | The system shall minimize missing ingredients and report them. | M |
| FR-REC-6 | The user shall set dietary preferences and exclusions (e.g. vegetarian, allergens). | S |
| FR-REC-7 | The user shall select "Cook this", which lays the used items to rest after confirmation. | M |
| FR-REC-8 | Generated ingredients shall be validated against inventory; hallucinated in-stock items shall be rejected. | M |

### 4.6 Spending, Savings, and Waste
| ID | Requirement | Pri |
|---|---|---|
| FR-FIN-1 | The system shall track total spend per receipt and per period (week, month). | M |
| FR-FIN-2 | The system shall compute "waste avoided" as the sum of prices of items used while at or before Expiring stage. | M |
| FR-FIN-3 | The system shall compute "wasted" value as the sum of prices of items discarded as spoiled. | M |
| FR-FIN-4 | The dashboard shall show spend, waste avoided, wasted, and at-risk value (price of items in Expiring/Rotting). | M |
| FR-FIN-5 | The system shall show a recipe-level estimated savings figure. | S |
| FR-FIN-6 | The system shall support an optional monthly budget with progress indication. | C |

### 4.6.0 Currency
| ID | Requirement | Pri |
|---|---|---|
| FR-CUR-1 | The system shall automatically detect each receipt's currency (ISO 4217 code) from symbols, codes, store address/country, tax format, and language on the receipt. | M |
| FR-CUR-2 | The system shall show the detected currency and a confidence indicator on the confirmation screen. | M |
| FR-CUR-3 | The user shall change the currency of a receipt before or after confirming it. This relabels the amounts and does not convert them, since it corrects a detection error. | M |
| FR-CUR-4 | When the currency is ambiguous (e.g. "$" without other clues, "kr"), the system shall preselect the user's default currency, mark it low confidence, and ask the user to check it. | M |
| FR-CUR-5 | On first launch, the system shall set the user's default currency from the device/browser locale, and the user shall change it in Settings. | M |
| FR-CUR-6 | The user shall choose a display currency for the ledger and dashboard (defaults to the default currency). | M |
| FR-CUR-7 | Amounts shall always be stored in their original receipt currency. Totals that mix currencies shall be converted to the display currency using daily exchange rates, with the rate date shown. | S |
| FR-CUR-8 | If exchange rates are unavailable, the ledger shall show per-currency subtotals instead of a converted total. | M |
| FR-CUR-9 | Amounts shall be formatted per the currency's symbol, decimal places (e.g. JPY 0, KWD 3), and the user's locale. | M |
| FR-CUR-10 | Manually added items shall default to the user's default currency, which the user can change. | M |

### 4.6.1 Platform and Notifications
| ID | Requirement | Pri |
|---|---|---|
| FR-PLT-1 | The product shall be available as a web app and an Android app with feature parity for all Must requirements. | M |
| FR-PLT-2 | A user's data shall sync across web and Android through the same account. | M |
| FR-PLT-3 | On Android, the user shall capture a receipt with the device camera, with crop/rotate before upload. | M |
| FR-PLT-4 | On Android, the app shall request camera and notification permissions in context and work (via gallery/manual entry) if denied. | M |
| FR-PLT-5 | On Android, the app shall offer an opt-in daily "cook tonight" notification at a time the user picks. It names the items that need cooking, is sent only on days when something is at risk, works offline (the next 7 days are scheduled locally and refreshed when the fridge changes), and opens the recipes tab when tapped. Permission is requested only when the user turns it on. | M |
| FR-RCP-7 | The user shall be able to add items by photographing the inside of a fridge, freezer or pantry shelf. Gemini lists what it sees; there are no prices and no receipt record. Because the purchase date is unknown, estimated dates count only half the usual shelf life. The photo goes to Gemini as an image, so the user must accept a separate privacy notice first, and the feature is unavailable when AI is off. | M |
| FR-RCP-8 | The fridge shall show a "Cook this tonight" card when food is at risk: one dinner idea written from the at-risk items and the user's diets (a plain nudge when AI is off). It never uses spoiled high-risk food. | M |
| FR-PLT-6 | The UI shall adapt layout: fridge centered with side panels on desktop, full-screen fridge with bottom navigation and bottom-sheet details on mobile. | M |
| FR-PLT-7 | The Android app shall handle the system back button, keep state across rotation/process death, and support light touch targets of at least 48 dp. | M |
| FR-PLT-8 | The Android app shall display the last synced inventory when offline, with a clear "offline" indicator, and disable actions requiring the network (scan, recipes). | S |
| FR-PLT-9 | The Android client shall be a native React Native app (not a WebView wrapper); the web client is built from the same React Native code. | M |

### 4.7 Accounts and Data
| ID | Requirement | Pri |
|---|---|---|
| FR-USR-1 | The user shall sign up and log in (email + password or OAuth). | M |
| FR-USR-2 | Each user's data shall be isolated from others. | M |
| FR-USR-3 | The user shall delete their account and all data, including receipt images. | S |

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-PERF-1 | Performance | Receipt OCR plus parsing shall complete in under 15 s for 95% of receipts. |
| NFR-PERF-2 | Performance | Fridge view shall render 100 items in under 1 s on a mid-range phone. |
| NFR-PERF-3 | Performance | Recipe generation shall return in under 20 s for 90% of requests (Gemini path), showing progress during generation. |
| NFR-RES-1 | Resources | The complete server system (OS, Docker, database, OCR fallback, API, web) shall run on a host with 4 GB RAM or less, with peak usage under 1.5 GB and idle usage under 1 GB. |
| NFR-RES-2 | Resources | Each service shall have a hard memory limit; scan jobs shall be queued with bounded concurrency. |
| NFR-RES-3 | Resources | When Gemini is unavailable or its quota is exhausted, the system shall keep working using local OCR and template recipes. |
| NFR-RES-4 | Resources | All components shall be free: open-source self-hosted services plus the Gemini API free tier. No paid service shall be required. |
| NFR-RES-6 | Resources | The system shall stay within configured Gemini free-tier limits (requests per minute and per day) and cap per-user daily AI usage. |
| NFR-RES-5 | Resources | The Android client shall use under 200 MB RAM while showing the fridge. |
| NFR-ACC-1 | Accuracy | Line-item extraction accuracy of at least 85% on a test set of clean receipts (post-confirmation correction is expected). |
| NFR-SEC-1 | Security | All traffic over TLS; passwords hashed with a modern algorithm (argon2/bcrypt). |
| NFR-SEC-2 | Security | Receipt images stored privately, accessible only to the owner, and deleted after confirmation or 24 h. |
| NFR-SEC-3 | Security | Gemini inputs shall exclude personal data other than the receipt image (EXIF stripped), ingredient names, and preferences. The API key shall exist only on the server, never in web or Android clients. |
| NFR-USA-1 | Usability | Core flow (upload to recipes) completable in under 3 minutes by a first-time user. |
| NFR-A11Y-1 | Accessibility | Freshness shall never be conveyed by color alone (icon, label, pattern also). Target WCAG 2.1 AA; reduced-motion setting disables animations. |
| NFR-REL-1 | Reliability | 99% monthly availability target for MVP. |
| NFR-REL-2 | Reliability | Failure of Gemini, OCR, or the exchange-rate source shall degrade gracefully with manual entry and fallback messaging. |
| NFR-PRV-1 | Privacy | Users can export and delete their data. |
| NFR-MNT-1 | Maintainability | Shelf-life table and food-safety rules shall be data-driven (config), not hard-coded. |
| NFR-COMP-1 | Compatibility | Responsive from 320 px width upward; Android 8.0 (API 26)+ (subject to the Expo SDK's minimum). |
| NFR-COMP-2 | Compatibility | Web and Android shall share at least 90% of UI and business logic code. |
| NFR-PERF-4 | Performance | Android cold start to interactive fridge in under 3 s on a mid-range device; APK/AAB under 40 MB. |
| NFR-SEC-4 | Security | Android auth tokens stored in Android Keystore-backed secure storage; cleartext traffic disabled. |

## 6. External Interfaces

### 6.1 User Interface
Haunted-kitchen visual theme with dark background, a central fridge, glowing and decaying item states. Main views: Fridge, Scan Receipt, Recipes, Ledger (spend/savings), Graveyard. The prototype in `prototype/index.html` shows the desktop web layout and the Android phone layout (resize the window below 800 px or use the device toggle).

### 6.2 Software Interfaces
- Android OS APIs (via native bridge): camera, file picker, local notifications, secure storage, share sheet
- Google Gemini API (`gemini-3.5-flash`, free tier) for receipt extraction including currency detection, ingredient normalization, unknown shelf life, and recipes
- Tesseract OCR (self-hosted) as the receipt fallback
- Frankfurter API (free, keyless, ECB rates) for daily exchange rates
- Object storage for images
- Relational database

## 7. Use Cases

### UC-1 Scan Receipt (main flow)
1. User opens Scan and uploads a receipt.
2. System runs OCR and shows extracted items.
3. User edits and confirms items.
4. System assigns categories and expiry estimates, adds items to the fridge.
5. Fridge shows new items; expiring ones glow.

Alternates: OCR fails (retry or manual); user cancels (nothing saved).

### UC-2 Generate Recipes
1. User taps "Summon recipes".
2. System selects at-risk ingredients and generates three recipes.
3. User views a recipe, sees saved items and missing ingredients.
4. User taps "Cook this" and confirms; items are laid to rest; waste avoided updates.

### UC-3 Review Fridge
1. User opens Fridge, sees items by zone with stage visuals.
2. User selects an item, views details, and marks used or discarded.

### UC-4 Discard Spoiled Item
User marks a Spoiled item discarded; it moves to the Graveyard and its price is added to wasted value.

## 8. MVP Acceptance Criteria
1. A user can upload a receipt and see extracted items with prices.
2. No item is added to inventory without explicit confirmation.
3. The fridge shows all items with five distinguishable freshness stages.
4. Expiring items are visually emphasized.
5. Exactly three recipes are generated, prioritizing expiring items, excluding rotting high-risk items.
6. The dashboard shows spend, waste avoided, and wasted value, updating after "Cook this".

## 9. Traceability (Kiro Usage)
| Kiro feature | Applied to |
|---|---|
| Custom agents | OCR/data extraction, recipe generation, UI, QA |
| Hooks | On receipt upload (process), daily/on-open expiry recalculation, on file save lint/test |
| Steering | Food-safety rules, budget rules, UI theme guidelines |
