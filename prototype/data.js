/* Ghost Kitchen Inventory - prototype data (mirrors rules/*.json described in the SDS). */
'use strict';

/* Freshness stages (SDS section 4 and 9.1). Icon + label so colour is never the only cue. */
const STAGES = {
  fresh:    { label: 'Fresh',    icon: '🌱', order: 4, weight: 1 },
  aging:    { label: 'Aging',    icon: '⏳', order: 3, weight: 2 },
  expiring: { label: 'Expiring', icon: '🔥', order: 2, weight: 3 },
  rotting:  { label: 'Rotting',  icon: '🪰', order: 1, weight: 4 },
  spoiled:  { label: 'Spoiled',  icon: '👻', order: 0, weight: 0 },
};

const ZONES = {
  freezer: { label: 'Freezer', icon: '❄️' },
  top:     { label: 'Top shelf · dairy & leftovers', icon: '🥛' },
  mid:     { label: 'Middle shelf · meat, fish & eggs', icon: '🍗' },
  crisper: { label: 'Crisper drawer · produce', icon: '🥬' },
  door:    { label: 'Door', icon: '🚪' },
  pantry:  { label: 'Pantry', icon: '🗄️' },
};

const CATEGORIES = ['produce', 'dairy', 'meat', 'fish', 'eggs', 'leftovers', 'bakery', 'dry', 'frozen', 'condiment', 'drink', 'other'];
const ZONE_OF = { produce: 'crisper', dairy: 'top', leftovers: 'top', meat: 'mid', fish: 'mid', eggs: 'mid',
  bakery: 'pantry', dry: 'pantry', frozen: 'freezer', condiment: 'door', drink: 'door', other: 'pantry' };
const CAT_SHELF = { produce: 7, dairy: 10, meat: 2, fish: 2, eggs: 21, leftovers: 3, bakery: 5, dry: 180, frozen: 90, condiment: 90, drink: 7, other: 30 };
const CAT_EMOJI = { produce: '🥗', dairy: '🥛', meat: '🥩', fish: '🐟', eggs: '🥚', leftovers: '🍱', bakery: '🍞', dry: '🫙', frozen: '🧊', condiment: '🫙', drink: '🧃', other: '📦' };
const RISK_CATS = new Set(['dairy', 'meat', 'fish', 'eggs', 'leftovers']);

/* Ingredient catalog: emoji, category, default shelf life (days), high-risk flag, optional zone override. */
const CATALOG = {
  'Spinach': ['🥬', 'produce', 5], 'Tomatoes': ['🍅', 'produce', 7], 'Bell pepper': ['🫑', 'produce', 10],
  'Carrots': ['🥕', 'produce', 21], 'Avocado': ['🥑', 'produce', 5], 'Strawberries': ['🍓', 'produce', 4],
  'Banana': ['🍌', 'produce', 5, false, 'pantry'], 'Onion': ['🧅', 'produce', 30, false, 'pantry'],
  'Garlic': ['🧄', 'produce', 60, false, 'pantry'], 'Potatoes': ['🥔', 'produce', 30, false, 'pantry'],
  'Lemon': ['🍋', 'produce', 21], 'Mushrooms': ['🍄', 'produce', 6], 'Cilantro': ['🌿', 'produce', 7],
  'Ginger': ['🍠', 'produce', 21], 'Milk': ['🥛', 'dairy', 7, true, 'door'], 'Greek yogurt': ['🥣', 'dairy', 14, true],
  'Cheddar': ['🧀', 'dairy', 28], 'Butter': ['🧈', 'dairy', 60], 'Eggs': ['🥚', 'eggs', 21, true],
  'Chicken breast': ['🍗', 'meat', 2, true], 'Ground beef': ['🥩', 'meat', 2, true], 'Salmon': ['🐟', 'fish', 2, true],
  'Shrimp': ['🦐', 'fish', 2, true], 'Leftover rice': ['🍚', 'leftovers', 4, true], 'Bread': ['🍞', 'bakery', 6],
  'Tortillas': ['🫓', 'bakery', 14], 'Pasta': ['🍝', 'dry', 365], 'Frozen broccoli': ['🥦', 'frozen', 180],
  'Ice cream': ['🍨', 'frozen', 60], 'Ketchup': ['🥫', 'condiment', 180], 'Orange juice': ['🧃', 'drink', 7],
};

/* Items that recipes only partly consume (half is used per cook). */
const PARTIAL = new Set(['Eggs', 'Milk', 'Cheddar', 'Butter', 'Garlic', 'Onion', 'Potatoes', 'Pasta', 'Greek yogurt', 'Frozen broccoli', 'Tortillas', 'Lemon']);

/* Sample receipts standing in for the Gemini extraction response (SDS section 5). */
const SAMPLES = [
  { store: 'FreshMart', city: 'Austin, TX', flag: '🇺🇸', hint: 'Clear receipt · "$" + US sales tax', sym: '$', dec: 2,
    currency: { code: 'USD', conf: 0.97, evidence: ['"$" symbol', 'Texas sales tax line', '+1 phone number'] },
    subtotal: 32.35, lines: [
      { raw: 'ORG BNLS CHKN BRST', name: 'Chicken breast', price: 7.99, cat: 'meat', conf: 0.93 },
      { raw: 'BABY SPINACH 5OZ', name: 'Spinach', price: 3.49, cat: 'produce', conf: 0.95 },
      { raw: 'HASS AVOCADO 2@1.25', name: 'Avocado', qty: 2, price: 2.50, cat: 'produce', conf: 0.88 },
      { raw: 'GRK YOG PLN 32Z', name: 'Greek yogurt', price: 4.29, cat: 'dairy', conf: 0.74 },
      { raw: 'SHRMP RAW 1LB', name: 'Shrimp', price: 9.99, cat: 'fish', conf: 0.62 },
      { raw: 'STRAWB 1LB', name: 'Strawberries', price: 3.99, cat: 'produce', conf: 0.90 },
      { raw: 'PAPER BAG', name: 'Paper bag', price: 0.10, cat: 'other', conf: 0.97, nonFood: true } ] },
  { store: 'Imtiaz Super Market', city: 'Lahore', flag: '🇵🇰', hint: '"Rs." prices · GST · Roman Urdu', sym: 'Rs.', dec: 0,
    currency: { code: 'PKR', conf: 0.95, evidence: ['"Rs." prefix', 'Lahore address', 'GST 18% line', '+92 phone number'] },
    subtotal: 2705, lines: [
      { raw: 'DOODH NESTLE 1LTR', name: 'Milk', price: 280, cat: 'dairy', conf: 0.81 },
      { raw: 'ANDAY DESI 12PC', name: 'Eggs', qty: 12, price: 420, cat: 'eggs', conf: 0.77 },
      { raw: 'TAMATAR 1KG', name: 'Tomatoes', price: 220, cat: 'produce', conf: 0.70 },
      { raw: 'ALOO 2KG', name: 'Potatoes', price: 260, cat: 'produce', conf: 0.85 },
      { raw: 'DHANIA GADDI', name: 'Cilantro', price: 40, cat: 'produce', conf: 0.58 },
      { raw: 'CHKN BONELESS 1KG', name: 'Chicken breast', price: 1350, cat: 'meat', conf: 0.90 },
      { raw: 'ADRAK 250G', name: 'Ginger', price: 120, cat: 'produce', conf: 0.66 },
      { raw: 'SHOPPER BAG', name: 'Shopping bag', price: 15, cat: 'other', conf: 0.92, nonFood: true } ] },
  { store: 'Corner Store', city: 'No address printed', flag: '❔', hint: 'Only a "$" sign · subtotal mismatch', sym: '$', dec: 2,
    currency: { symbol: '$', conf: 0.55, evidence: ['only a "$" symbol, no address, phone or tax line'] },
    subtotal: 19.76, lines: [
      { raw: 'MUSHRM WHT 8OZ', name: 'Mushrooms', price: 3.29, cat: 'produce', conf: 0.80 },
      { raw: 'CHEDDAR BLK 8OZ', name: 'Cheddar', price: 6.49, cat: 'dairy', conf: 0.85 },
      { raw: 'TORTILLA FLR 10', name: 'Tortillas', price: 2.99, cat: 'bakery', conf: 0.90 },
      { raw: 'OJ 52OZ', name: 'Orange juice', price: 4.99, cat: 'drink', conf: 0.66 } ] },
  { store: 'Lidl', city: 'Berlin', flag: '🇩🇪', hint: '"€" · German labels · MwSt', sym: '€', dec: 2,
    currency: { code: 'EUR', conf: 0.96, evidence: ['"€" symbol', 'MwSt 7% line', 'Berlin address'] },
    subtotal: 11.20, lines: [
      { raw: 'Lachsfilet 250g', name: 'Salmon', price: 4.99, cat: 'fish', conf: 0.86 },
      { raw: 'Paprika rot', name: 'Bell pepper', price: 1.29, cat: 'produce', conf: 0.82 },
      { raw: 'Champignons 400g', name: 'Mushrooms', price: 1.49, cat: 'produce', conf: 0.84 },
      { raw: 'Dt. Markenbutter', name: 'Butter', price: 2.19, cat: 'dairy', conf: 0.88 },
      { raw: 'Zitronen 500g', name: 'Lemon', price: 0.99, cat: 'produce', conf: 0.79 },
      { raw: 'Pfand', name: 'Bottle deposit', price: 0.25, cat: 'other', conf: 0.95, nonFood: true } ] },
];

/* Recipe templates. In the real app Gemini writes recipes; these double as the offline fallback (SDS section 6). */
const TEMPLATES = [
  { title: 'Banana French Toast', emoji: '🍞', min: 15, serv: 2, veg: true, main: 'Bread', ing: ['Bread', 'Eggs', 'Milk', 'Banana', 'Butter'],
    steps: ['Whisk eggs, milk and a pinch of salt.', 'Soak bread slices for 20 seconds per side.', 'Fry in butter until golden.', 'Top with sliced banana.'] },
  { title: 'Chicken & Pepper Fajitas', emoji: '🌮', min: 25, serv: 3, veg: false, main: 'Chicken breast', ing: ['Chicken breast', 'Bell pepper', 'Onion', 'Tortillas', 'Avocado', 'Lemon'],
    steps: ['Slice chicken, pepper and onion into strips.', 'Sear chicken in a hot pan until cooked through (74°C inside).', 'Add vegetables and cook 4 minutes.', 'Serve in warm tortillas with mashed avocado and lemon.'] },
  { title: 'Spinach & Mushroom Frittata', emoji: '🍳', min: 20, serv: 3, veg: true, main: 'Eggs', ing: ['Eggs', 'Spinach', 'Mushrooms', 'Cheddar', 'Onion'],
    steps: ['Sauté onion and mushrooms in oil.', 'Wilt the spinach in the pan.', 'Pour in beaten eggs, top with cheddar.', 'Cook on low, then finish under the grill.'] },
  { title: 'Strawberry Banana Smoothie', emoji: '🥤', min: 5, serv: 2, veg: true, main: 'Strawberries', ing: ['Strawberries', 'Banana', 'Greek yogurt', 'Milk'],
    steps: ['Hull the strawberries.', 'Blend everything with a few ice cubes.', 'Serve straight away.'] },
  { title: 'Leftover Fried Rice', emoji: '🍚', min: 15, serv: 2, veg: true, main: 'Leftover rice', ing: ['Leftover rice', 'Eggs', 'Carrots', 'Frozen broccoli', 'Garlic', 'Onion'],
    steps: ['Dice carrots and onion, mince garlic.', 'Stir-fry vegetables in a very hot pan.', 'Add rice and fry until steaming hot throughout.', 'Push aside, scramble eggs, then toss together.'] },
  { title: 'Tomato & Spinach Pasta', emoji: '🍝', min: 25, serv: 3, veg: true, main: 'Pasta', ing: ['Pasta', 'Tomatoes', 'Spinach', 'Garlic', 'Cheddar'],
    steps: ['Boil pasta in salted water.', 'Soften garlic and chopped tomatoes in oil.', 'Stir in spinach until wilted.', 'Toss with pasta and grated cheddar.'] },
  { title: 'Creamy Mushroom Toast', emoji: '🍄', min: 15, serv: 2, veg: true, main: 'Mushrooms', ing: ['Mushrooms', 'Bread', 'Butter', 'Garlic', 'Cheddar'],
    steps: ['Fry sliced mushrooms in butter with garlic.', 'Toast the bread.', 'Pile mushrooms on toast and melt cheddar on top.'] },
  { title: 'Lemon Garlic Salmon & Potatoes', emoji: '🐟', min: 30, serv: 2, veg: false, main: 'Salmon', ing: ['Salmon', 'Lemon', 'Garlic', 'Potatoes', 'Butter'],
    steps: ['Roast cubed potatoes at 220°C for 20 minutes.', 'Add salmon with butter, garlic and lemon slices.', 'Roast 10–12 minutes until the fish flakes.'] },
  { title: 'Chicken Potato Curry', emoji: '🍛', min: 40, serv: 4, veg: false, main: 'Potatoes', ing: ['Chicken breast', 'Potatoes', 'Tomatoes', 'Onion', 'Garlic', 'Ginger', 'Greek yogurt'],
    steps: ['Brown onion, garlic and ginger.', 'Add tomatoes and cook down.', 'Add chicken and potatoes with water, simmer 25 minutes.', 'Stir in yogurt off the heat.'] },
  { title: 'Guacamole & Toasted Tortillas', emoji: '🥑', min: 10, serv: 2, veg: true, main: 'Avocado', ing: ['Avocado', 'Tomatoes', 'Onion', 'Lemon', 'Cilantro', 'Tortillas'],
    steps: ['Mash avocado with lemon juice and salt.', 'Fold in diced tomato, onion and cilantro.', 'Toast tortilla wedges and dip.'] },
  { title: 'Veggie Omelette', emoji: '🥚', min: 10, serv: 1, veg: true, main: 'Bell pepper', ing: ['Eggs', 'Bell pepper', 'Tomatoes', 'Onion', 'Cheddar'],
    steps: ['Dice the vegetables and soften them in oil.', 'Pour over beaten eggs.', 'Add cheddar, fold and serve.'] },
  { title: 'Garlic Shrimp Pasta', emoji: '🦐', min: 20, serv: 2, veg: false, main: 'Shrimp', ing: ['Shrimp', 'Pasta', 'Garlic', 'Lemon', 'Butter', 'Spinach'],
    steps: ['Cook pasta.', 'Sauté shrimp in butter and garlic until pink and opaque.', 'Add spinach, lemon and pasta, toss.'] },
];

/* ---------- Currency tables (SDS section 3.2) ---------- */
/* Region -> currency, used to set the default currency from the device/browser locale. */
const REGION_CUR = { US: 'USD', GB: 'GBP', PK: 'PKR', IN: 'INR', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY',
  AE: 'AED', SA: 'SAR', KW: 'KWD', QA: 'QAR', NG: 'NGN', ZA: 'ZAR', BR: 'BRL', MX: 'MXN', CH: 'CHF', SE: 'SEK', NO: 'NOK',
  DK: 'DKK', PL: 'PLN', TR: 'TRY', SG: 'SGD', HK: 'HKD', KR: 'KRW', EG: 'EGP', BD: 'BDT', ID: 'IDR', MY: 'MYR', PH: 'PHP',
  TH: 'THB', LK: 'LKR', NP: 'NPR', KE: 'KES',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR',
  SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', LU: 'EUR', MT: 'EUR', CY: 'EUR', HR: 'EUR' };

/* Symbols shared by several currencies. Detection marks these low confidence and asks the user to check. */
const AMBIGUOUS = {
  '$': ['USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'MXN'],
  'kr': ['SEK', 'NOK', 'DKK', 'ISK'],
  '¥': ['JPY', 'CNY'],
  'Rs': ['PKR', 'INR', 'LKR', 'NPR'],
};

/* Demo ECB-style reference rates (1 EUR = x). The real app fetches these daily from the free Frankfurter API.
   Currencies missing here (e.g. PKR, AED, SAR) are not published by the ECB, so totals fall back to per-currency. */
const RATES_DATE_OFFSET = -1;
const RATES = { EUR: 1, USD: 1.08, GBP: 0.85, JPY: 165, CHF: 0.95, CAD: 1.49, AUD: 1.65, NZD: 1.8, SEK: 11.4, NOK: 11.6,
  DKK: 7.46, PLN: 4.3, CZK: 25.2, HUF: 395, INR: 91, CNY: 7.8, HKD: 8.4, SGD: 1.45, KRW: 1480, MXN: 19.5, BRL: 6.0,
  ZAR: 19.8, TRY: 37, ILS: 4.0, THB: 37, IDR: 17500, MYR: 4.9, PHP: 62, RON: 4.97, ISK: 150 };

const FALLBACK_CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'JPY', 'CNY', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK',
  'AED', 'SAR', 'KWD', 'QAR', 'BDT', 'LKR', 'NPR', 'SGD', 'HKD', 'KRW', 'MXN', 'BRL', 'ZAR', 'TRY', 'EGP', 'NGN', 'KES',
  'IDR', 'MYR', 'PHP', 'THB', 'PLN', 'CZK', 'HUF', 'RON', 'ILS', 'ISK'];

const EPITAPHS = ['Gone, but not forgotten in the crisper.', 'Should have been an omelette.', 'Lost behind the ketchup.',
  'It had so much left to give.', 'Rest in pieces.', 'Forever fresh in our hearts.', 'Ate by no one.'];
