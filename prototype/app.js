/* Ghost Kitchen Inventory - UI prototype. Vanilla JS, no build step, no network calls.
   Gemini, Tesseract and the exchange-rate API are simulated with local data (see data.js). */
'use strict';
(() => {
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const LOCALE = navigator.language || 'en-US';
const DAY = 864e5;
const sod = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const TODAY = sod(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return sod(x); };
const daysBetween = (a, b) => Math.round((sod(b) - sod(a)) / DAY);
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
const fmtDate = d => d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let uidN = 0;
const uid = () => 'i' + (++uidN);

/* ---------- Currency helpers (amounts are integer minor units + ISO code) ---------- */
const digitsCache = {};
function digits(cur) {
  if (!(cur in digitsCache)) {
    try { digitsCache[cur] = new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits; }
    catch { digitsCache[cur] = 2; }
  }
  return digitsCache[cur];
}
function fmt(minor, cur) {
  try { return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur }).format(minor / 10 ** digits(cur)); }
  catch { return `${cur} ${(minor / 10 ** digits(cur)).toFixed(digits(cur))}`; }
}
function curSymbol(cur) {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find(p => p.type === 'currency').value;
  } catch { return cur; }
}
let curNames = null;
try { curNames = new Intl.DisplayNames([LOCALE, 'en'], { type: 'currency' }); } catch { /* older browser */ }
const curName = c => { try { return curNames ? curNames.of(c) : c; } catch { return c; } };
let ALL_CURRENCIES = FALLBACK_CURRENCIES;
try { if (Intl.supportedValuesOf) ALL_CURRENCIES = Intl.supportedValuesOf('currency'); } catch { /* keep fallback */ }
const isValidCur = c => ALL_CURRENCIES.includes(c);
function localeCurrency() {
  try { const r = new Intl.Locale(LOCALE).maximize().region; return REGION_CUR[r] || 'USD'; } catch { return 'USD'; }
}

/* resolveCurrency: shared rule from SDS 3.2 (detected code -> ambiguous symbol -> user default). */
function resolveCurrency(det, def, hint) {
  if (det.code && det.conf >= 0.8 && isValidCur(det.code)) {
    return { code: det.code, conf: det.conf, source: 'detected', evidence: det.evidence };
  }
  if (det.symbol && AMBIGUOUS[det.symbol]) {
    const cands = AMBIGUOUS[det.symbol];
    const code = hint && cands.includes(hint) ? hint : cands.includes(def) ? def : cands[0];
    const ev = [...det.evidence];
    if (hint === code) ev.push(`you picked ${code} for this store before`);
    else if (code === def) ev.push('matches your default currency');
    return { code, conf: Math.min(det.conf, hint === code ? 0.75 : 0.6), source: 'detected', evidence: ev, candidates: cands };
  }
  return { code: def, conf: 0.3, source: 'default', evidence: ['no currency found on the receipt'] };
}

/* Convert {cur: minor} to one currency using ECB-style rates. Returns null if any currency is not covered. */
function convertAll(by, to) {
  if (!(to in RATES)) return null;
  let major = 0;
  for (const c of Object.keys(by)) {
    if (!(c in RATES)) return null;
    major += by[c] / 10 ** digits(c) / RATES[c] * RATES[to];
  }
  return Math.round(major * 10 ** digits(to));
}
function sumBy(entries) {
  const by = {};
  entries.forEach(e => { if (e.minor) by[e.cur] = (by[e.cur] || 0) + e.minor; });
  return by;
}
/* Present a multi-currency sum in the display currency (SDS section 8). */
function moneyView(by) {
  const disp = state.settings.displayCurrency;
  const curs = Object.keys(by);
  if (!curs.length) return { main: fmt(0, disp), ok: true, value: 0, converted: false, curs };
  if (curs.length === 1 && curs[0] === disp) return { main: fmt(by[disp], disp), ok: true, value: by[disp], converted: false, curs };
  const conv = convertAll(by, disp);
  const parts = curs.map(c => fmt(by[c], c)).join(' + ');
  if (conv != null) return { main: fmt(conv, disp), sub: `from ${parts}`, ok: true, value: conv, converted: true, curs };
  const uncovered = [...new Set([...curs, disp].filter(c => !(c in RATES)))];
  return { main: parts, ok: false, converted: false, uncovered, curs };
}
const money = entries => moneyView(sumBy(entries)).main;

/* ---------- Expiry engine (SDS section 4) ---------- */
const daysLeft = it => daysBetween(TODAY, it.expires);
function stageOf(it) {
  const rem = daysLeft(it), total = Math.max(1, it.shelfDays);
  if (rem < 0 && it.highRisk) return 'spoiled';      // high-risk food skips "rotting"
  if (rem < -3) return 'spoiled';
  if (rem < 0) return 'rotting';
  if (rem <= 2 || rem / total <= 0.25) return 'expiring';
  if (rem / total <= 0.5) return 'aging';
  return 'fresh';
}
const cookable = it => { const s = stageOf(it); return s !== 'spoiled' && !(s === 'rotting' && it.highRisk); };
const remText = r => r > 1 ? `${r} days left` : r === 1 ? '1 day left' : r === 0 ? 'Expires today' : r === -1 ? 'Expired 1 day ago' : `Expired ${-r} days ago`;
const shortRem = r => r > 0 ? `${r}d left` : r === 0 ? 'today' : `${-r}d over`;
function lookup(name) {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  const key = Object.keys(CATALOG).find(k => k.toLowerCase() === n || k.toLowerCase() === n.replace(/e?s$/, ''));
  if (!key) return null;
  const [emoji, cat, shelf, risk, zone] = CATALOG[key];
  return { name: key, emoji, cat, shelf, risk: !!risk, zone: zone || ZONE_OF[cat] };
}
function makeItem({ name, category, qty = 1, priceMinor, currency, purchased, shelf }) {
  const c = lookup(name);
  const cat = c ? c.cat : category || 'other';
  const days = shelf ?? (c ? c.shelf : CAT_SHELF[cat]);
  return { id: uid(), name: c ? c.name : name.trim(), emoji: c ? c.emoji : CAT_EMOJI[cat], category: cat,
    zone: c ? c.zone : ZONE_OF[cat], highRisk: c ? c.risk : RISK_CATS.has(cat), qty, priceMinor, currency,
    purchased, shelfDays: days, expires: addDays(purchased, days), status: 'active', fraction: 1,
    expirySource: c ? 'default' : 'model' };
}
const SOURCE_LABEL = { default: 'shelf-life table', user: 'set by you', model: 'estimated by Gemini (low confidence)' };

/* ---------- State ---------- */
const state = {
  view: 'fridge', history: [], selected: null, overlay: null, focusOv: false,
  filter: 'all', q: '', items: [], receipts: [], events: [],
  scanStep: 'pick', proc: null, draft: null,
  recipes: null, generating: false, lastCooked: null,
  settings: { defaultCurrency: localeCurrency(), displayCurrency: localeCurrency(), vegetarian: false,
    reduceMotion: false, tesseractOnly: false, offline: false, aiNoticeSeen: false, digest: true },
  recent: [], storeHints: {}, justAdded: new Set(), quota: { used: 14, limit: 250 },
};
const active = () => state.items.filter(i => i.status === 'active');
const byId = id => state.items.find(i => i.id === id);

/* ---------- Demo data ---------- */
function seed() {
  // [name, bought N days ago, price in USD cents, qty]
  const rows = [['Spinach', 4, 349], ['Strawberries', 3, 399], ['Avocado', 7, 125], ['Tomatoes', 4, 299], ['Bell pepper', 2, 149],
    ['Carrots', 3, 129], ['Mushrooms', 5, 329], ['Cilantro', 12, 99], ['Milk', 5, 389], ['Greek yogurt', 6, 429],
    ['Cheddar', 10, 649], ['Butter', 20, 499], ['Eggs', 12, 459, 12], ['Chicken breast', 1, 799], ['Ground beef', 4, 699],
    ['Leftover rice', 3, 250], ['Bread', 4, 349], ['Onion', 10, 99], ['Garlic', 8, 79], ['Potatoes', 6, 399],
    ['Pasta', 20, 189], ['Lemon', 15, 69], ['Frozen broccoli', 14, 249], ['Ice cream', 9, 599], ['Ketchup', 30, 329],
    ['Orange juice', 6, 449], ['Banana', 6, 159], ['Tortillas', 3, 299]];
  state.items = rows.map(([name, ago, price, qty]) =>
    makeItem({ name, qty: qty || 1, priceMinor: price, currency: 'USD', purchased: addDays(TODAY, -ago) }));
  state.receipts = [
    { store: "Trader Bob's", date: addDays(TODAY, -4), currency: 'USD', totalMinor: 3870 },
    { store: 'FreshMart', date: addDays(TODAY, -9), currency: 'USD', totalMinor: 6420 }];
  state.events = [
    { type: 'used', name: 'Broccoli', emoji: '🥦', minor: 279, cur: 'USD', stage: 'expiring', date: addDays(TODAY, -3) },
    { type: 'discarded', name: 'Lettuce', emoji: '🥬', minor: 249, cur: 'USD', stage: 'spoiled', date: addDays(TODAY, -5), purchased: addDays(TODAY, -14) },
    { type: 'used', name: 'Peaches', emoji: '🍑', minor: 399, cur: 'USD', stage: 'aging', date: addDays(TODAY, -6) },
    { type: 'discarded', name: 'Sour cream', emoji: '🥣', minor: 199, cur: 'USD', stage: 'spoiled', date: addDays(TODAY, -9), purchased: addDays(TODAY, -30) }];
  Object.assign(state, { selected: null, overlay: null, recipes: null, lastCooked: null, draft: null, scanStep: 'pick', filter: 'all', q: '' });
}

/* ---------- Device / layout ---------- */
let device = new URLSearchParams(location.search).get('device') === 'android' ? 'android' : 'web';
const isNarrow = () => window.innerWidth < 800;
const isPhone = () => device === 'android' || isNarrow();
const hasSide = () => !isPhone() && window.innerWidth >= 1180;
const useSheetForItem = () => !hasSide();
function applyDevice() {
  document.body.classList.toggle('narrow', isNarrow());
  document.body.classList.toggle('device-android', device === 'android' && !isNarrow());
  document.querySelectorAll('#previewbar [data-device]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.device === device)));
  app.classList.toggle('phone', isPhone());
  app.classList.toggle('noside', !isPhone() && !hasSide());
  if (state.overlay?.kind === 'item' && !useSheetForItem()) state.overlay = null;
  render();
}
const NAV = [['fridge', '🧊', 'Fridge'], ['scan', '🧾', 'Scan'], ['recipes', '🍲', 'Recipes'], ['ledger', '📒', 'Ledger'],
  ['graveyard', '🪦', 'Graveyard'], ['settings', '⚙️', 'Settings']];

/* ---------- Render shell ---------- */
let lastView = null;
function render() {
  const prev = $('#view');
  const keep = prev && lastView === state.view ? prev.scrollTop : 0;
  const phone = isPhone();
  app.innerHTML = `${topbar()}${phone ? '' : rail()}
    <main id="view" tabindex="-1" aria-label="${h(NAV.find(n => n[0] === state.view)[2])}">${offlineBanner()}${viewHTML()}</main>
    ${hasSide() ? `<aside id="side" aria-label="Details">${sideHTML()}</aside>` : ''}
    ${phone ? bottomNav() : ''}
    ${phone && state.view === 'fridge' ? '<button class="fab" data-action="go" data-view="scan">🧾 Scan receipt</button>' : ''}
    ${overlayHTML()}`;
  const v = $('#view');
  if (v) v.scrollTop = keep;
  lastView = state.view;
  document.body.classList.toggle('reduce-motion', state.settings.reduceMotion);
  if (state.overlay && state.focusOv) {
    state.focusOv = false;
    const f = $('.ov [autofocus]') || $('.ov button, .ov input');
    if (f) f.focus();
  }
}
function counts() {
  const c = { fresh: 0, aging: 0, expiring: 0, rotting: 0, spoiled: 0 };
  active().forEach(i => c[stageOf(i)]++);
  return c;
}
function topbar() {
  const c = counts(), n = c.expiring + c.rotting + c.spoiled, phone = isPhone();
  return `<header class="topbar">
    <div class="brand"><span class="logo" aria-hidden="true">👻</span><div><strong>Ghost Kitchen</strong>${phone ? '' : '<small>Inventory</small>'}</div></div>
    ${!phone && state.view === 'fridge'
      ? `<label class="search"><span class="sr-only">Search the fridge</span><input type="search" data-input="search" placeholder="Search the fridge…" value="${h(state.q)}"></label>`
      : '<span class="grow"></span>'}
    <button class="haunt" data-action="filter-haunts" aria-label="${n} items need attention. Show them">🕯️ <strong>${n}</strong>${phone ? '' : ' haunting'}</button>
    ${phone ? '<button class="iconbtn" data-action="go" data-view="settings" aria-label="Settings">⚙️</button>'
      : `<button class="btn primary" data-action="summon" ${state.settings.offline ? 'disabled' : ''}>✨ Summon recipes</button>`}
  </header>`;
}
function rail() {
  const q = state.quota;
  return `<nav class="rail" aria-label="Main">${NAV.map(([v, i, l]) =>
    `<button data-action="go" data-view="${v}" ${state.view === v ? 'aria-current="page"' : ''}><span aria-hidden="true">${i}</span>${l === 'Scan' ? 'Scan receipt' : l}</button>`).join('')}
    <div class="quota">${state.settings.tesseractOnly ? '🔒 Tesseract-only mode' : `Gemini free tier today<br><strong>${q.used} / ${q.limit}</strong> requests`}
      ${state.settings.tesseractOnly ? '' : `<div class="bar"><span style="width:${Math.min(100, q.used / q.limit * 100)}%"></span></div>`}</div>
  </nav>`;
}
function bottomNav() {
  return `<nav class="bottomnav" aria-label="Main">${NAV.slice(0, 5).map(([v, i, l]) =>
    `<button data-action="go" data-view="${v}" ${state.view === v ? 'aria-current="page"' : ''}><span aria-hidden="true">${i}</span><span>${l}</span></button>`).join('')}</nav>`;
}
const offlineBanner = () => state.settings.offline && isPhone()
  ? '<div class="offline" role="status">📴 Offline. Showing your fridge from the last sync. Scanning and recipes need a connection.</div>' : '';

function viewHTML() {
  switch (state.view) {
    case 'scan': return scanView();
    case 'recipes': return recipesView();
    case 'ledger': return ledgerView();
    case 'graveyard': return graveyardView();
    case 'settings': return settingsView();
    default: return fridgeView();
  }
}

/* ---------- Fridge view ---------- */
const atRiskEntries = () => active().filter(i => ['expiring', 'rotting'].includes(stageOf(i))).map(i => ({ minor: Math.round(i.priceMinor * i.fraction), cur: i.currency }));
function fridgeView() {
  const c = counts(), total = active().length;
  const chips = [['all', '✨', 'All', total], ['haunts', '🕯️', 'Haunting', c.expiring + c.rotting + c.spoiled],
    ...Object.entries(STAGES).sort((a, b) => b[1].order - a[1].order).map(([k, s]) => [k, s.icon, s.label, c[k]])];
  const spoiled = active().filter(i => stageOf(i) === 'spoiled');
  return `<div class="viewhead"><div><h1>Your fridge</h1>
      <p class="muted">${total} items · ${c.expiring} expiring soon · ${money(atRiskEntries())} at risk</p></div>
      <button class="btn" data-action="manual">＋ Add item</button></div>
    ${isPhone() ? `<div class="phone-search"><input type="search" data-input="search" placeholder="Search the fridge…" value="${h(state.q)}" aria-label="Search the fridge"></div>` : ''}
    <div class="chips" role="group" aria-label="Filter by freshness">${chips.map(([k, i, l, n]) =>
      `<button class="chip" data-action="filter" data-f="${k}" aria-pressed="${state.filter === k}"><span aria-hidden="true">${i}</span> ${l} <b>${n}</b></button>`).join('')}</div>
    ${spoiled.length ? `<div class="callout ghosty"><span style="font-size:26px" aria-hidden="true">👻</span><div>
      <strong>${spoiled.length} ${spoiled.length === 1 ? 'spirit is' : 'spirits are'} haunting your fridge.</strong><br>
      <span class="muted">${h(spoiled.map(i => i.name).join(', '))} ${spoiled.length === 1 ? 'has' : 'have'} spoiled. Lay ${spoiled.length === 1 ? 'it' : 'them'} in the graveyard.</span></div>
      <button class="btn" data-action="bury-all">🪦 Bury ${spoiled.length}</button></div>` : ''}
    <div id="fridgeZones">${fridgeHTML()}</div>`;
}
function matches(it) {
  const s = stageOf(it), f = state.filter;
  if (f === 'haunts' && !['expiring', 'rotting', 'spoiled'].includes(s)) return false;
  if (f !== 'all' && f !== 'haunts' && s !== f) return false;
  return !state.q || it.name.toLowerCase().includes(state.q.trim().toLowerCase());
}
function zoneHTML(z) {
  const list = active().filter(i => i.zone === z && matches(i))
    .sort((a, b) => STAGES[stageOf(a)].order - STAGES[stageOf(b)].order || daysLeft(a) - daysLeft(b));
  const filtered = state.filter !== 'all' || state.q;
  return `<section class="zone z-${z}" aria-label="${ZONES[z].label}"><span class="zone-label"><span aria-hidden="true">${ZONES[z].icon}</span> ${ZONES[z].label}</span>
    <div class="items">${list.length ? list.map(itemHTML).join('') : `<span class="empty">${filtered ? 'Nothing matches here' : 'Empty'}</span>`}</div></section>`;
}
function fridgeHTML() {
  return `<div class="kitchen">
    <div class="fridge" role="group" aria-label="Fridge">
      <div class="fridge-body"><div class="lamp" aria-hidden="true"></div>${zoneHTML('freezer')}${zoneHTML('top')}${zoneHTML('mid')}${zoneHTML('crisper')}</div>
      <div class="fridge-door">${zoneHTML('door')}</div>
    </div>
    <div class="pantry" role="group" aria-label="Pantry">${zoneHTML('pantry')}</div>
  </div>`;
}

function itemHTML(it) {
  const s = stageOf(it), st = STAGES[s], rem = daysLeft(it);
  const cls = ['item', `st-${s}`, state.selected === it.id ? 'selected' : '', state.justAdded.has(it.id) ? 'new' : ''].join(' ');
  return `<button class="${cls}" data-action="select" data-id="${it.id}" aria-label="${h(it.name)}, ${st.label}, ${remText(rem)}${it.fraction < 1 ? ', partly used' : ''}">
    <span class="emoji" aria-hidden="true">${it.emoji}</span>
    <span class="iname" aria-hidden="true">${h(it.name)}</span>
    <span class="idays" aria-hidden="true">${shortRem(rem)}</span>
    <span class="badge" aria-hidden="true" title="${st.label}">${st.icon}</span>
    ${s === 'rotting' ? '<span class="flies" aria-hidden="true"><i></i><i></i><i></i></span><span class="drip" aria-hidden="true"></span>' : ''}
    ${s === 'spoiled' ? '<span class="ghost" aria-hidden="true">👻</span>' : ''}
    ${it.fraction < 1 ? '<span class="frac" aria-hidden="true">½</span>' : ''}
  </button>`;
}
function advice(it, s) {
  if (s === 'spoiled' && it.highRisk) return ['danger', `⚠️ This ${it.category} is past its safe window. Don't taste-test it. Discard it.`];
  if (s === 'spoiled') return ['danger', 'This has most likely gone bad. Compost or discard it.'];
  if (s === 'rotting') return ['', 'Use today only if it still looks and smells fine. Trim soft spots; discard anything moldy.'];
  if (s === 'expiring' && it.highRisk) return ['', 'Cook it today and cook it through.'];
  if (s === 'expiring') return ['', 'Use it in the next day or two. Summon a recipe to rescue it.'];
  return null;
}
function detailHTML(it, inSheet) {
  const s = stageOf(it), st = STAGES[s], rem = daysLeft(it);
  const frac = Math.max(0, Math.min(1, rem / Math.max(1, it.shelfDays)));
  const adv = advice(it, s);
  return `<div class="detail">
    <div class="dhead"><span class="big" aria-hidden="true">${it.emoji}</span>
      <div><h2 id="ovTitle">${h(it.name)}</h2><span class="pill" style="--c:var(--${s})">${st.icon} ${st.label}</span></div>
      <button class="iconbtn" data-action="${inSheet ? 'close-overlay' : 'deselect'}" aria-label="Close details">✕</button></div>
    <div class="meter" role="meter" aria-label="Freshness remaining" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(frac * 100)}">
      <span style="width:${Math.max(3, frac * 100)}%;background:var(--${s})"></span></div>
    <p class="remline">${remText(rem)}</p>
    ${adv ? `<div class="advice ${adv[0]}">${adv[1]}</div>` : ''}
    <dl class="facts">
      <dt>Quantity</dt><dd>${it.qty}${it.fraction < 1 ? ` · ${Math.round(it.fraction * 100)}% left` : ''}</dd>
      <dt>Price</dt><dd>${fmt(it.priceMinor, it.currency)}</dd>
      <dt>Bought</dt><dd>${fmtDate(it.purchased)}</dd>
      <dt><label for="exp-${it.id}">Expires</label></dt>
      <dd><input type="date" id="exp-${it.id}" data-input="expiry" data-id="${it.id}" value="${isoDate(it.expires)}"><br><small class="muted">${SOURCE_LABEL[it.expirySource]}</small></dd>
      <dt>Stored in</dt><dd>${ZONES[it.zone].label}</dd>
    </dl>
    <div class="actions">
      ${cookable(it) ? `<button class="btn primary" data-action="use" data-id="${it.id}">🕯️ Lay to rest (used)</button>
        <button class="btn" data-action="half" data-id="${it.id}">Used half</button>` : ''}
      <button class="btn danger" data-action="discard" data-id="${it.id}">🪦 Discard</button>
    </div>
    <p class="disclaimer">Freshness is estimated from typical shelf life. Food-safety tips are guidance, not a guarantee.</p>
  </div>`;
}

/* ---------- Side panel (desktop) ---------- */
function sideHTML() {
  const sel = state.selected && byId(state.selected);
  if (sel && sel.status === 'active') return detailHTML(sel, false);
  const risky = active().filter(i => ['expiring', 'rotting', 'spoiled'].includes(stageOf(i)))
    .sort((a, b) => daysLeft(a) - daysLeft(b));
  const avoided = state.events.filter(e => e.type === 'used' && e.stage !== 'fresh');
  const wasted = state.events.filter(e => e.type === 'discarded');
  return `<h2>🕯️ Haunting now</h2>
    <p class="muted small">${risky.length} items need attention · ${money(atRiskEntries())} at risk</p>
    <ul class="risklist">${risky.map(i => { const s = stageOf(i); return `<li><button data-action="select" data-id="${i.id}" style="--c:var(--${s})">
      <span aria-hidden="true">${i.emoji}</span><span>${h(i.name)}<br><small class="muted">${STAGES[s].icon} ${STAGES[s].label} · ${remText(daysLeft(i))}</small></span></button></li>`; }).join('')
      || '<li class="muted">Nothing haunting. Nice.</li>'}</ul>
    <button class="btn primary" style="width:100%" data-action="summon" ${state.settings.offline ? 'disabled' : ''}>✨ Summon 3 rescue recipes</button>
    <h2 style="margin-top:22px">Last 30 days</h2>
    <div class="stat"><span>Waste avoided</span><strong style="color:var(--fresh)">${money(avoided)}</strong></div>
    <div class="stat"><span>Wasted</span><strong style="color:var(--danger)">${money(wasted)}</strong></div>
    <p class="muted small" style="margin-top:12px">Select any item in the fridge to see details.</p>`;
}

/* ---------- Scan view ---------- */
const scanSteps = () => state.settings.tesseractOnly
  ? ['Uploading', 'Reading text with Tesseract', 'Parsing lines', 'Detecting currency', 'Estimating expiry']
  : ['Uploading', 'Gemini is reading the receipt', 'Matching ingredients', 'Detecting currency', 'Estimating expiry'];
function scanView() {
  if (state.scanStep === 'processing') return processingView();
  if (state.scanStep === 'confirm' && state.draft) return confirmView();
  const phone = isPhone(), off = state.settings.offline;
  return `<div class="viewhead"><div><h1>Scan a receipt</h1>
      <p class="muted">We'll read items, prices and the currency. You check everything before it goes in the fridge.</p></div></div>
    <div class="dropzone" data-drop>
      <div class="dz-ghost" aria-hidden="true">🧾👻</div>
      <p><strong>${phone ? 'Snap your receipt' : 'Drop a receipt image here'}</strong></p>
      <p class="muted small">JPG, PNG or HEIC up to 10 MB · read by ${state.settings.tesseractOnly ? 'Tesseract on your server' : 'Gemini (free tier)'}</p>
      <div class="row">
        <label class="btn primary">📷 ${phone ? 'Take photo' : 'Choose image'}<input class="sr-only" type="file" accept="image/*,.heic" ${phone ? 'capture="environment"' : ''} data-input="file" ${off ? 'disabled' : ''}></label>
        ${phone ? `<label class="btn">🖼️ Gallery<input class="sr-only" type="file" accept="image/*,.heic" data-input="file" ${off ? 'disabled' : ''}></label>` : ''}
        <button class="btn" data-action="manual">✍️ Enter manually</button>
      </div>
    </div>
    <h2 class="h3">Or try a sample receipt</h2>
    <div class="samples">${SAMPLES.map((s, i) => `<button class="sample" data-action="sample" data-i="${i}" ${off ? 'disabled' : ''}>
      <span class="flag" aria-hidden="true">${s.flag}</span><strong>${h(s.store)}</strong><small>${h(s.city)}</small><small class="muted">${h(s.hint)}</small></button>`).join('')}</div>`;
}

function receiptPaper(s) {
  return `<div class="paper" role="img" aria-label="Sample receipt from ${h(s.store)}">
    <div class="p-store">${h(s.store.toUpperCase())}</div><div class="p-city">${h(s.city)}</div>
    ${s.lines.map(l => `<div class="p-line"><span>${h(l.raw)}</span><span>${h(s.sym)}${l.price.toFixed(s.dec)}</span></div>`).join('')}
    <div class="p-line p-tot"><span>SUBTOTAL</span><span>${h(s.sym)}${s.subtotal.toFixed(s.dec)}</span></div></div>`;
}
function processingView() {
  const p = state.proc, steps = scanSteps(), s = SAMPLES[p.sample];
  return `<div class="viewhead"><div><h1>Reading your receipt…</h1><p class="muted">Hang tight. Spirits are deciphering the fine print.</p></div></div>
    <div class="proc">
      <div class="receipt-preview">${p.image ? `<img src="${p.image}" alt="Your receipt">` : receiptPaper(s)}<div class="scanline" aria-hidden="true"></div></div>
      <ol class="steps" aria-live="polite">${steps.map((t, i) => `<li class="${i < p.step ? 'done' : i === p.step ? 'active' : ''}">
        ${i < p.step ? '✓' : i === p.step ? '<span class="spinner" aria-hidden="true"></span>' : '○'} ${t}${i === p.step ? '<span class="sr-only"> in progress</span>' : ''}</li>`).join('')}</ol>
    </div>`;
}
function curSourceText(d) {
  if (d.curSource === 'user') return 'Set by you. Amounts were relabeled, not converted.';
  if (d.curSource === 'default') return d.manual ? 'Your default currency.' : 'No currency found on the receipt, so we used your default.';
  return `Detected from ${d.evidence.join(', ')}.`;
}
function confirmView() {
  const d = state.draft, low = d.curConf < 0.8, sym = curSymbol(d.currency), step = 10 ** -digits(d.currency);
  const sum = d.lines.reduce((a, l) => a + (Number.isFinite(l.price) ? l.price : 0), 0);
  const mismatch = d.subtotal != null && Math.abs(sum - d.subtotal) > step / 2;
  return `<div class="viewhead"><div><h1>${d.manual ? 'Add items' : 'Check your haul'}</h1>
      <p class="muted">${h(d.store)} · Nothing is added until you confirm.</p></div></div>
    ${d.uploaded ? '<div class="callout info">🧪 <div><strong>Prototype note:</strong> your image stays in this browser. The real app sends it to the server for Gemini to read. These are demo results.</div></div>' : ''}
    ${d.source === 'ocr' ? '<div class="callout info">🔒 <div>Read locally with Tesseract. It is less accurate, so more rows are flagged for review.</div></div>' : ''}
    <div class="curbar"><span class="muted">Currency</span>
      <button class="curchip ${low ? 'low' : ''}" data-action="pick-currency" data-target="draft" aria-label="Receipt currency: ${h(curName(d.currency))} (${d.currency})${low ? ', please check' : ''}. Change">
        <span class="sym" aria-hidden="true">${h(sym)}</span><strong>${d.currency}</strong><span>${h(curName(d.currency))}</span>
        ${low ? '<span class="check-badge">CHECK</span>' : ''}<span aria-hidden="true">▾</span></button>
      <small class="muted">${h(curSourceText(d))}</small></div>
    ${low ? `<div class="callout warn">💱 <div>We're not sure about the currency${d.candidates ? `. "${h(d.symbol)}" is used by ${d.candidates.join(', ')}` : ''}. Tap the currency to confirm it.</div></div>` : ''}
    ${mismatch ? `<div class="callout warn">🧮 <div>Lines add up to <strong>${h(sym)}${sum.toFixed(digits(d.currency))}</strong> but the receipt subtotal says <strong>${h(sym)}${d.subtotal.toFixed(digits(d.currency))}</strong>. A line may be missing.</div></div>` : ''}
    <div class="metarow"><label>Purchased <input type="date" data-input="draft-date" value="${d.date}"></label>
      <span class="muted small">Prices are line totals in ${d.currency}.</span></div>
    <div class="lines" role="list" aria-label="Receipt items">
      <div class="line head" aria-hidden="true"><span></span><span>Item</span><span>Qty</span><span>Price</span><span>Category</span><span>Conf.</span><span></span></div>
      ${d.lines.map(l => lineHTML(l, sym, step)).join('')}
    </div>
    <div class="confirmbar"><div class="tot">Total <strong id="draftTotal">${draftTotal()}</strong></div>
      <button class="btn" data-action="add-line">＋ Row</button>
      <button class="btn" data-action="cancel-scan">Cancel</button>
      <button class="btn primary" data-action="confirm-scan" ${state.settings.offline ? 'disabled' : ''}>Confirm & stock fridge</button></div>`;
}

function lineHTML(l, sym, step) {
  const lvl = l.conf >= 0.85 ? 'high' : l.conf >= 0.7 ? 'mid' : 'low';
  const dg = digits(state.draft.currency);
  const price = Number.isFinite(l.price) ? l.price.toFixed(dg) : '';
  return `<div class="line ${l.conf < 0.7 ? 'low' : ''} ${l.include ? '' : 'excluded'}" data-line="${l.id}" role="listitem">
    <input class="l-inc" type="checkbox" data-input="line" data-f="include" ${l.include ? 'checked' : ''} aria-label="Include ${h(l.name || 'this row')}">
    <div class="l-name"><input data-input="line" data-f="name" value="${h(l.name)}" placeholder="Item name" aria-label="Item name">
      ${l.raw || l.nonFood ? `<small class="raw">${l.raw ? `“${h(l.raw)}”` : ''}${l.nonFood ? ' · non-food, not stocked' : ''}</small>` : ''}</div>
    <input class="l-qty" type="number" min="0" step="1" inputmode="numeric" data-input="line" data-f="qty" value="${l.qty}" aria-label="Quantity">
    <div class="l-price"><span class="sym" aria-hidden="true">${h(sym)}</span>
      <input type="number" min="0" step="${step}" inputmode="decimal" data-input="line" data-f="price" value="${price}" aria-label="Price in ${state.draft.currency}"></div>
    <select class="l-cat" data-input="line" data-f="category" aria-label="Category">${CATEGORIES.map(c => `<option value="${c}" ${c === l.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
    <span class="l-conf conf-${lvl}" title="Reading confidence">${l.manual ? '—' : Math.round(l.conf * 100) + '%'}<span class="sr-only"> confidence</span></span>
    <button class="iconbtn l-del" data-action="del-line" data-id="${l.id}" aria-label="Remove ${h(l.name || 'row')}">🗑️</button>
  </div>`;
}
function draftTotal() {
  const d = state.draft;
  const sum = d.lines.filter(l => l.include && Number.isFinite(l.price)).reduce((a, l) => a + l.price, 0);
  const n = d.lines.filter(l => l.include && !l.nonFood && l.name.trim()).length;
  return `${fmt(Math.round(sum * 10 ** digits(d.currency)), d.currency)} · ${n} item${n === 1 ? '' : 's'}`;
}
function buildDraft(i, opts) {
  const s = SAMPLES[i], tess = state.settings.tesseractOnly;
  const cur = resolveCurrency(s.currency, state.settings.defaultCurrency, state.storeHints[s.store]);
  return { store: s.store, date: isoDate(TODAY), currency: cur.code, curConf: tess ? Math.min(cur.conf, cur.conf * 0.9) : cur.conf,
    curSource: cur.source, evidence: cur.evidence, candidates: cur.candidates, symbol: s.currency.symbol,
    subtotal: s.subtotal, uploaded: !!opts.image, source: tess ? 'ocr' : 'gemini',
    lines: s.lines.map(l => ({ id: uid(), raw: l.raw, name: l.name, qty: l.qty || 1, price: l.price, category: l.cat,
      conf: tess ? l.conf * 0.85 : l.conf, include: !l.nonFood, nonFood: !!l.nonFood })) };
}
const blankLine = () => ({ id: uid(), raw: '', name: '', qty: 1, price: NaN, category: 'produce', conf: 1, include: true, nonFood: false, manual: true });
function startManual() {
  state.draft = { store: 'Manual entry', manual: true, date: isoDate(TODAY), currency: state.settings.defaultCurrency, curConf: 1,
    curSource: 'default', evidence: [], subtotal: null, source: 'manual', lines: [blankLine()] };
  state.scanStep = 'confirm';
  go('scan', true);
}

/* Scan flow: one-time Gemini notice -> simulated processing -> confirm table. */
function requestScan(opts) {
  if (state.settings.offline) { toast('You are offline. Scanning needs a connection.'); return; }
  if (!state.settings.aiNoticeSeen && !state.settings.tesseractOnly) { openOverlay({ kind: 'notice', pending: opts }); return; }
  startScan(opts);
}
function startScan(opts) {
  state.proc = { sample: opts.sample ?? 0, image: opts.image || null, step: 0 };
  state.scanStep = 'processing';
  state.draft = null;
  go('scan', true);
  const tick = () => {
    if (state.scanStep !== 'processing' || !state.proc) return;
    state.proc.step++;
    if (state.proc.step >= scanSteps().length) {
      state.draft = buildDraft(state.proc.sample, state.proc);
      if (!state.settings.tesseractOnly) state.quota.used++;
      state.scanStep = 'confirm';
      state.proc = null;
      render();
      toast(`Found ${state.draft.lines.length} lines · currency ${state.draft.currency}`);
      return;
    }
    if (state.view === 'scan') render();
    setTimeout(tick, 650);
  };
  setTimeout(tick, 650);
}
function handleFile(file) {
  if (!file) return;
  const okType = /^image\//.test(file.type) || /\.heic$/i.test(file.name);
  if (!okType) { toast('That file is not an image. Try a JPG, PNG or HEIC.'); return; }
  if (file.size > 10 * 1024 * 1024) { toast('That image is over 10 MB. Try a smaller photo.'); return; }
  const r = new FileReader();
  r.onload = () => requestScan({ sample: 0, image: r.result });
  r.onerror = () => toast('Could not read that file.');
  r.readAsDataURL(file);
}
function confirmScan() {
  const d = state.draft;
  const lines = d.lines.filter(l => l.include && l.name.trim());
  if (!lines.length) { toast('Include at least one item with a name.'); return; }
  if (lines.some(l => !Number.isFinite(l.price) || l.price < 0)) { toast('One price is empty or negative. Please check it.'); return; }
  const dg = digits(d.currency), purchased = parseIso(d.date) || TODAY;
  let total = 0; const added = [];
  lines.forEach(l => {
    const minor = Math.round(l.price * 10 ** dg);
    total += minor;
    if (l.nonFood) return;
    const it = makeItem({ name: l.name, category: l.category, qty: l.qty || 1, priceMinor: minor, currency: d.currency, purchased });
    state.items.push(it); added.push(it.id);
  });
  state.receipts.unshift({ store: d.store, date: purchased, currency: d.currency, totalMinor: total });
  if (d.curSource === 'user' && !d.manual) state.storeHints[d.store] = d.currency;
  state.justAdded = new Set(added);
  state.draft = null; state.scanStep = 'pick'; state.filter = 'all'; state.q = '';
  go('fridge', true);
  toast(`🧊 ${added.length} item${added.length === 1 ? '' : 's'} moved into the fridge`);
  setTimeout(() => state.justAdded.clear(), 1500);
}

/* ---------- Recipes (SDS section 6): urgency-weighted, greedy for coverage, no unsafe items ---------- */
function generateRecipes() {
  const pool = active().filter(cookable);
  const best = {};   // most urgent usable item per ingredient name
  pool.forEach(i => { const b = best[i.name]; if (!b || daysLeft(i) < daysLeft(b)) best[i.name] = i; });
  const cands = TEMPLATES.filter(t => !state.settings.vegetarian || t.veg).map(t => {
    const used = [], missing = [];
    t.ing.forEach(n => (best[n] ? used.push(best[n]) : missing.push(n)));
    return { ...t, used, missing };
  }).filter(r => r.used.length >= 2 && r.used.some(i => stageOf(i) !== 'fresh'));
  const picked = [], covered = new Set(), mains = new Set();
  const w = i => STAGES[stageOf(i)].weight ** 2;
  while (picked.length < 3) {
    let top = null, topScore = -Infinity;
    cands.forEach(r => {
      if (picked.includes(r) || mains.has(r.main)) return;
      const score = r.used.reduce((a, i) => a + (covered.has(i.id) ? 0.3 : 1) * w(i), 0) - 1.5 * r.missing.length;
      if (score > topScore) { top = r; topScore = score; }
    });
    if (!top) break;
    picked.push(top); mains.add(top.main); top.used.forEach(i => covered.add(i.id));
  }
  return picked.map(r => ({ ...r,
    saves: r.used.filter(i => stageOf(i) !== 'fresh'),
    saving: r.used.filter(i => stageOf(i) !== 'fresh').map(i => ({ minor: Math.round(i.priceMinor * i.fraction * (PARTIAL.has(i.name) ? 0.5 : 1)), cur: i.currency })) }));
}
function summon() {
  if (state.settings.offline) { toast('You are offline. Recipes need a connection.'); return; }
  state.generating = true; state.lastCooked = null;
  go('recipes', true);
  setTimeout(() => {
    state.recipes = generateRecipes();
    state.recipeSource = state.settings.tesseractOnly ? 'Template (offline mode)' : 'Gemini · simulated';
    if (!state.settings.tesseractOnly) state.quota.used++;
    state.generating = false;
    if (state.view === 'recipes') render();
  }, 1400);
}
function recipeCard(r, i) {
  const desktop = !isPhone();
  return `<article class="recipe" aria-labelledby="r${i}">
    <div class="r-hero" aria-hidden="true">${r.emoji}</div>
    <h2 id="r${i}">${h(r.title)}</h2>
    <p class="muted small">⏱ ${r.min} min · 🍽 ${r.serv} servings · ${r.missing.length ? `${r.missing.length} to buy` : 'all in your fridge'}</p>
    <div class="saves"><span class="muted small">Rescues</span>${r.saves.map(it => { const s = stageOf(it); return `<span class="mini" style="--c:var(--${s})">${it.emoji} ${h(it.name)} <span aria-hidden="true">${STAGES[s].icon}</span><span class="sr-only">(${STAGES[s].label})</span></span>`; }).join('')}</div>
    <details ${desktop ? 'open' : ''}><summary>Ingredients & steps</summary>
      <ul class="ing">${r.used.map(it => `<li class="ok">✓ ${h(it.name)} <small class="muted">· in fridge, ${STAGES[stageOf(it)].label.toLowerCase()}</small></li>`).join('')}
        ${r.missing.map(n => `<li class="miss">✗ ${h(n)} <small>· need to buy</small></li>`).join('')}
        <li class="staple">＋ Salt, pepper, oil (pantry staples)</li></ul>
      <ol>${r.steps.map(s => `<li>${h(s)}</li>`).join('')}</ol></details>
    <div class="r-foot"><div><small class="muted">Saves about</small><strong>${money(r.saving)}</strong></div>
      <button class="btn primary" data-action="cook" data-i="${i}">🍳 Cook this</button></div>
  </article>`;
}

function recipesView() {
  const risky = active().filter(i => ['expiring', 'rotting'].includes(stageOf(i)) && cookable(i));
  const head = `<div class="viewhead"><div><h1>Recipes from the brink</h1>
      <p class="muted">Three recipes that use what's about to turn. Spoiled and unsafe items are never included.</p></div>
      <div class="actions"><button class="chip" data-action="toggle-veg" aria-pressed="${state.settings.vegetarian}">🥕 Vegetarian</button>
      <button class="btn primary" data-action="summon" ${state.generating || state.settings.offline ? 'disabled' : ''}>${state.recipes ? '↻ Summon again' : '✨ Summon 3 recipes'}</button></div></div>`;
  const cooked = state.lastCooked ? `<div class="callout good"><span style="font-size:24px" aria-hidden="true">${state.lastCooked.emoji}</span><div>
      <strong>${h(state.lastCooked.title)} cooked.</strong> ${state.lastCooked.n} ingredients laid to rest, about <strong>${state.lastCooked.saved}</strong> of food rescued.</div></div>` : '';
  if (state.generating) return head + `<div class="summoning" role="status"><span class="orb" aria-hidden="true">🔮</span>
      <p><strong>Summoning spirits…</strong></p><p class="muted">${state.settings.tesseractOnly ? 'Ranking offline recipe templates' : 'Gemini is writing 3 recipes around your expiring food'}</p></div>`;
  if (!state.recipes) return head + cooked + `<div class="card"><h2>${risky.length} ingredients are close to turning</h2>
      <div class="saves">${risky.map(it => `<span class="mini" style="--c:var(--${stageOf(it)})">${it.emoji} ${h(it.name)} · ${shortRem(daysLeft(it))}</span>`).join('') || '<span class="muted">Nothing urgent right now.</span>'}</div>
      <p class="muted small">Tap Summon and we'll build recipes around these first.</p></div>`;
  if (!state.recipes.length) return head + '<div class="card">No recipes fit what you have right now. Try turning off filters or scanning a receipt.</div>';
  return head + cooked + `<p class="muted small">Source: ${h(state.recipeSource)}${state.recipes.length < 3 ? ` · only ${state.recipes.length} good match${state.recipes.length === 1 ? '' : 'es'} found` : ''}</p>
    <div class="recipes">${state.recipes.map(recipeCard).join('')}</div>`;
}
function cookRecipe(i) {
  const r = state.recipes[i]; if (!r) return;
  const saved = [];
  r.used.forEach(it => {
    if (it.status !== 'active') return;
    const res = useItem(it.id, PARTIAL.has(it.name) ? 0.5 : 1, true);
    if (res && res.stage !== 'fresh') saved.push({ minor: res.value, cur: it.currency });
  });
  state.lastCooked = { title: r.title, emoji: r.emoji, n: r.used.length, saved: money(saved) };
  state.recipes = null; state.overlay = null;
  render();
  toast(`🕯️ ${r.used.length} ingredients laid to rest · ${state.lastCooked.saved} rescued`);
}

/* ---------- Item actions ---------- */
function useItem(id, part, silent) {
  const it = byId(id); if (!it || it.status !== 'active') return null;
  const stage = stageOf(it);
  let portion = part >= 1 ? it.fraction : it.fraction * part;
  if (it.fraction - portion <= 0.26) portion = it.fraction;   // a sliver left counts as used up
  const value = Math.round(it.priceMinor * portion);
  state.events.unshift({ type: 'used', name: it.name, emoji: it.emoji, minor: value, cur: it.currency, stage, date: TODAY });
  it.fraction -= portion;
  if (it.fraction <= 0) { it.status = 'used'; it.fraction = 0; }
  if (!silent) {
    if (it.status !== 'active') { state.selected = null; if (state.overlay?.kind === 'item') state.overlay = null; }
    render();
    toast(it.status !== 'active' ? `🕯️ ${it.name} laid to rest${stage !== 'fresh' ? ` · ${fmt(value, it.currency)} rescued` : ''}` : `Half of ${it.name} used`);
  }
  return { value, stage };
}

function discardItem(id, silent) {
  const it = byId(id); if (!it || it.status !== 'active') return null;
  const value = Math.round(it.priceMinor * it.fraction);
  state.events.unshift({ type: 'discarded', name: it.name, emoji: it.emoji, minor: value, cur: it.currency, stage: stageOf(it), date: TODAY, purchased: it.purchased });
  it.status = 'discarded'; it.fraction = 0;
  if (!silent) {
    state.selected = null;
    if (state.overlay?.kind === 'item') state.overlay = null;
    render();
    toast(`🪦 ${it.name} buried · ${fmt(value, it.currency)} lost`);
  }
  return { value, cur: it.currency };
}
function buryAll() {
  const lost = active().filter(i => stageOf(i) === 'spoiled').map(i => discardItem(i.id, true));
  state.overlay = null; state.selected = null;
  render();
  toast(`🪦 ${lost.length} buried · ${money(lost.map(l => ({ minor: l.value, cur: l.cur })))} lost`);
}

/* ---------- Ledger (SDS section 8) ---------- */
function ledgerView() {
  const disp = state.settings.displayCurrency;
  const spend = moneyView(sumBy(state.receipts.map(r => ({ minor: r.totalMinor, cur: r.currency }))));
  const avoided = moneyView(sumBy(state.events.filter(e => e.type === 'used' && e.stage !== 'fresh')));
  const wasted = moneyView(sumBy(state.events.filter(e => e.type === 'discarded')));
  const risk = moneyView(sumBy(atRiskEntries()));
  const all = [spend, avoided, wasted, risk];
  const converted = all.some(m => m.converted), uncovered = [...new Set(all.flatMap(m => m.uncovered || []))];
  const kpi = (label, m, c, note) => `<div class="kpi" style="--c:${c}"><small>${label}</small><span class="v">${m.main}</span>
    <small>${m.sub ? h(m.sub) : note}</small></div>`;
  const rate = avoided.ok && wasted.ok && (avoided.value + wasted.value) > 0 ? Math.round(avoided.value / (avoided.value + wasted.value) * 100) : null;
  const rd = fmtDate(addDays(TODAY, RATES_DATE_OFFSET));
  return `<div class="viewhead"><div><h1>Ledger</h1><p class="muted">Last 30 days · amounts are kept in their original currency</p></div>
      <button class="curchip" data-action="pick-currency" data-target="display" aria-label="Display currency ${disp}. Change">
        <span class="muted small">Show in</span><span class="sym" aria-hidden="true">${h(curSymbol(disp))}</span><strong>${disp}</strong><span aria-hidden="true">▾</span></button></div>
    <div class="kpis">${kpi('Spent', spend, 'var(--accent)', `${state.receipts.length} receipts`)}
      ${kpi('Waste avoided', avoided, 'var(--fresh)', 'used before it spoiled')}
      ${kpi('Wasted', wasted, 'var(--danger)', 'buried in the graveyard')}
      ${kpi('At risk now', risk, 'var(--expiring)', 'expiring or rotting')}</div>
    ${converted ? `<p class="muted small">💱 Converted to ${disp} at ECB reference rates from ${rd} (demo values; the app fetches these daily from the free Frankfurter API).</p>` : ''}
    ${uncovered.length ? `<div class="callout warn">💱 <div>${uncovered.join(', ')} ${uncovered.length === 1 ? "isn't" : "aren't"} covered by ECB rates, so mixed totals are shown per currency instead of converted.</div></div>` : ''}
    ${rate != null ? `<div class="rescue"><div class="stat" style="border:0"><span>Rescue rate</span><strong>${rate}% of at-risk food saved</strong></div>
      <div class="bar" role="img" aria-label="${rate}% rescued"><span style="width:${rate}%"></span></div></div>` : ''}
    <div class="card"><h2>Receipts</h2><table class="table"><thead><tr><th>Store</th><th>Date</th><th class="num">Total</th></tr></thead>
      <tbody>${state.receipts.map(r => `<tr><td>${h(r.store)}</td><td>${fmtDate(r.date)}</td><td class="num">${fmt(r.totalMinor, r.currency)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><h2>Activity</h2><table class="table"><tbody>${state.events.slice(0, 12).map(e => `<tr>
      <td>${e.emoji} ${h(e.name)}</td><td>${e.type === 'used' ? `🕯️ Laid to rest · ${STAGES[e.stage].label.toLowerCase()}` : '🪦 Buried'}</td>
      <td class="num" style="color:${e.type === 'used' ? (e.stage !== 'fresh' ? 'var(--fresh)' : 'var(--muted)') : 'var(--danger)'}">${e.type === 'used' ? '' : '−'}${fmt(e.minor, e.cur)}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------- Graveyard ---------- */
function graveyardView() {
  const graves = state.events.filter(e => e.type === 'discarded');
  const ep = n => EPITAPHS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % EPITAPHS.length];
  return `<div class="viewhead"><div><h1>The graveyard</h1>
      <p class="muted">${graves.length} buried · ${money(graves)} lost. Every grave is a recipe that could have been.</p></div></div>
    ${graves.length ? `<div class="graves">${graves.map(g => `<div class="tomb" role="group" aria-label="${h(g.name)}, buried ${fmtDate(g.date)}">
      <div class="rip" aria-hidden="true">R.I.P</div><div class="e" aria-hidden="true">${g.emoji}</div><strong>${h(g.name)}</strong>
      <div class="small muted">${g.purchased ? `${fmtDate(g.purchased)} – ` : ''}${fmtDate(g.date)}</div>
      <div class="ep">“${ep(g.name)}”</div><div class="lost">−${fmt(g.minor, g.cur)}</div></div>`).join('')}</div>`
      : '<div class="card">No graves yet. Everything has been eaten in time.</div>'}`;
}

/* ---------- Settings ---------- */
const toggle = (k, label, sub) => `<div class="setrow"><label class="toggle"><input type="checkbox" role="switch" data-input="setting" data-k="${k}" ${state.settings[k] ? 'checked' : ''}>
  <span class="track" aria-hidden="true"></span><span><strong>${label}</strong>${sub ? `<small>${sub}</small>` : ''}</span></label></div>`;
const curButton = (target, code) => `<button class="curchip" data-action="pick-currency" data-target="${target}" aria-label="${h(curName(code))} (${code}). Change">
  <span class="sym" aria-hidden="true">${h(curSymbol(code))}</span><strong>${code}</strong><span aria-hidden="true">▾</span></button>`;
function settingsView() {
  const s = state.settings, q = state.quota;
  return `<div class="viewhead"><div><h1>Settings</h1></div></div>
    <section class="card" aria-labelledby="set-cur"><h2 id="set-cur">💱 Currency</h2>
      <div class="setrow"><div><strong>Default currency</strong><small>Used when a receipt has no clear currency and for manual items. Set from your device language (${h(LOCALE)}).</small></div>${curButton('default', s.defaultCurrency)}</div>
      <div class="setrow"><div><strong>Display currency</strong><small>Ledger totals and recipe savings are shown in this. Other currencies get converted when rates exist.</small></div>${curButton('display', s.displayCurrency)}</div>
    </section>
    <section class="card" aria-labelledby="set-rec"><h2 id="set-rec">🍲 Recipes</h2>${toggle('vegetarian', 'Vegetarian recipes only')}</section>
    <section class="card" aria-labelledby="set-ai"><h2 id="set-ai">🤖 AI & privacy</h2>
      ${toggle('tesseractOnly', 'Tesseract only (keep receipts on my server)', 'Skips Gemini. Less accurate reading; recipes come from offline templates.')}
      <div class="setrow"><div><strong>Gemini free tier today</strong><small>${s.tesseractOnly ? 'Not in use.' : `${q.used} of ${q.limit} requests used. When it runs out the app switches to Tesseract and templates.`}</small>
        <div class="bar"><span style="width:${s.tesseractOnly ? 0 : Math.min(100, q.used / q.limit * 100)}%"></span></div></div></div>
      <p class="muted small">Receipt images (location data removed) and ingredient names are sent to Google Gemini. On the free tier, Google may use submitted content to improve its products.</p></section>
    <section class="card" aria-labelledby="set-a11y"><h2 id="set-a11y">♿ Accessibility</h2>${toggle('reduceMotion', 'Reduce motion', 'Stops glowing, flies and floating ghosts.')}</section>
    <section class="card" aria-labelledby="set-and"><h2 id="set-and">🤖 Android</h2>
      ${toggle('digest', 'Daily expiry digest at 9:00', 'Local notification listing items about to turn.')}
      ${toggle('offline', 'Simulate offline', 'Shows the cached fridge; scanning and recipes are disabled.')}</section>
    <section class="card"><h2>Demo</h2><button class="btn" data-action="reset">↺ Reset demo data</button></section>`;
}

/* ---------- Overlays: bottom sheet on phone/Android, modal on desktop ---------- */
function overlayHTML() {
  const o = state.overlay; if (!o) return '';
  let body = '';
  if (o.kind === 'item') { const it = byId(o.id); if (!it || it.status !== 'active') return ''; body = detailHTML(it, true); }
  else if (o.kind === 'currency') body = currencyPickerHTML(o);
  else if (o.kind === 'cook') body = cookHTML(o);
  else if (o.kind === 'notice') body = noticeHTML();
  else if (o.kind === 'bury') body = buryHTML();
  return `<div class="scrim" data-action="close-overlay"></div>
    <div class="${isPhone() ? 'sheet' : 'modal'} ov" role="dialog" aria-modal="true" aria-labelledby="ovTitle">${body}</div>`;
}
const ovHead = t => `<div class="ovhead"><h2 id="ovTitle">${t}</h2><button class="iconbtn" data-action="close-overlay" aria-label="Close">✕</button></div>`;
function pickerCurrent(o) {
  return o.target === 'draft' ? state.draft.currency : o.target === 'default' ? state.settings.defaultCurrency : state.settings.displayCurrency;
}
function currencyPickerHTML(o) {
  const title = { draft: 'Receipt currency', default: 'Default currency', display: 'Display currency' }[o.target];
  const note = { draft: 'Fixes a wrong guess. Amounts are relabeled, not converted.',
    default: 'Used when a receipt has no clear currency and for manual items.',
    display: 'Ledger and savings are shown in this currency.' }[o.target];
  return `${ovHead(title)}<p class="muted small">${note}</p>
    <input class="fullinput" type="search" data-input="cur-search" placeholder="Search by code, name or symbol…" aria-label="Search currencies" aria-controls="curList" autofocus>
    <ul class="curlist" id="curList" role="listbox" aria-label="Currencies">${curListHTML(o, '')}</ul>`;
}
function curListHTML(o, q) {
  const cur = pickerCurrent(o), qq = q.trim().toLowerCase();
  const hit = c => !qq || c.toLowerCase().includes(qq) || curName(c).toLowerCase().includes(qq) || curSymbol(c).toLowerCase() === qq;
  const likely = o.target === 'draft' && state.draft.candidates ? state.draft.candidates : [];
  const recent = state.recent.filter(c => !likely.includes(c));
  const rest = ALL_CURRENCIES.filter(c => !likely.includes(c) && !recent.includes(c));
  const opt = c => `<li><button class="curopt" role="option" aria-selected="${c === cur}" data-action="set-currency" data-code="${c}">
    <span class="sym" aria-hidden="true">${h(curSymbol(c))}</span><strong>${c}</strong><span class="nm">${h(curName(c))}</span>${c === cur ? '✓' : ''}</button></li>`;
  const group = (label, list) => { const l = list.filter(hit); return l.length ? `<li class="grp" role="presentation">${label}</li>${l.map(opt).join('')}` : ''; };
  return (group('Likely for this receipt', likely) + group('Recent', recent) + group('All currencies', rest)) || '<li class="muted" style="padding:10px">No currency matches.</li>';
}
function setCurrency(code) {
  const o = state.overlay; if (!o || !isValidCur(code)) return;
  if (o.target === 'draft') {
    const d = state.draft, changed = d.currency !== code;
    Object.assign(d, { currency: code, curConf: 1, curSource: changed ? 'user' : d.curSource === 'default' ? 'user' : d.curSource });
    if (d.curSource === 'user') d.candidates = null;
    toast(changed ? `Receipt relabeled as ${code}. Amounts were not converted.` : `${code} confirmed`);
  } else if (o.target === 'default') state.settings.defaultCurrency = code;
  else state.settings.displayCurrency = code;
  state.recent = [code, ...state.recent.filter(c => c !== code)].slice(0, 3);
  state.overlay = null;
  render();
}

function cookHTML(o) {
  const r = state.recipes && state.recipes[o.i]; if (!r) return ovHead('Recipe not found');
  const full = r.used.filter(i => !PARTIAL.has(i.name)), half = r.used.filter(i => PARTIAL.has(i.name));
  const li = list => list.map(i => `<li>${i.emoji} ${h(i.name)} <small class="muted">· ${STAGES[stageOf(i)].label.toLowerCase()}</small></li>`).join('');
  return `${ovHead(`Cook ${h(r.title)}?`)}
    ${full.length ? `<p><strong>Laid to rest</strong></p><ul>${li(full)}</ul>` : ''}
    ${half.length ? `<p><strong>Half used</strong></p><ul>${li(half)}</ul>` : ''}
    ${r.missing.length ? `<p class="muted small">You'll still need: ${h(r.missing.join(', '))}.</p>` : ''}
    <p>That rescues about <strong style="color:var(--fresh)">${money(r.saving)}</strong> of food.</p>
    <div class="actions"><button class="btn" data-action="close-overlay">Not yet</button>
      <button class="btn primary" data-action="cook-confirm" data-i="${o.i}" autofocus>🕯️ Lay them to rest</button></div>`;
}
function noticeHTML() {
  return `${ovHead('Before your first scan')}
    <p>Receipt photos are sent to <strong>Google Gemini</strong> (free tier) to read items, prices and the currency. Only the image, with location data removed, and ingredient names are sent. Never your email or account.</p>
    <p class="muted small">On the free tier, Google may use submitted content to improve its products. Prefer to keep receipts on your own server? Use Tesseract only. It's less accurate, so you'll correct more rows.</p>
    <div class="actions"><button class="btn" data-action="notice-tess">🔒 Use Tesseract only</button>
      <button class="btn primary" data-action="notice-gemini" autofocus>Continue with Gemini</button></div>`;
}
function buryHTML() {
  const sp = active().filter(i => stageOf(i) === 'spoiled');
  return `${ovHead(`Bury ${sp.length} spoiled item${sp.length === 1 ? '' : 's'}?`)}
    <ul>${sp.map(i => `<li>${i.emoji} ${h(i.name)} · ${remText(daysLeft(i))}</li>`).join('')}</ul>
    <p class="muted small">They move to the graveyard and count as wasted (${money(sp.map(i => ({ minor: Math.round(i.priceMinor * i.fraction), cur: i.currency })))}).</p>
    <div class="actions"><button class="btn" data-action="close-overlay">Keep for now</button>
      <button class="btn danger" data-action="bury-confirm" autofocus>🪦 Bury them</button></div>`;
}
function openOverlay(o) { state.overlay = o; state.focusOv = true; render(); }
function closeOverlay() {
  if (state.overlay?.kind === 'item') state.selected = null;
  state.overlay = null; render();
  const v = $('#view'); if (v) v.focus({ preventScroll: true });
}

/* ---------- Navigation & Android back ---------- */
function go(view, force) {
  if (view !== state.view) { state.history.push(state.view); if (state.history.length > 20) state.history.shift(); }
  else if (!force && view === 'scan' && state.scanStep !== 'processing' && !state.draft) state.scanStep = 'pick';
  state.view = view; state.overlay = null;
  if (view !== 'fridge' && useSheetForItem()) state.selected = null;
  render();
  const v = $('#view'); if (v) { v.scrollTop = 0; v.focus({ preventScroll: true }); }
}
function back() {
  if (state.overlay) { closeOverlay(); return; }
  if (state.selected && hasSide()) { state.selected = null; render(); return; }
  const prev = state.history.pop();
  if (prev) { state.view = prev; render(); return; }
  toast('This is the home screen. Back again would close the app.');
}
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ---------- Events ---------- */
const ACTIONS = {
  go: el => go(el.dataset.view),
  select: el => {
    const id = el.dataset.id;
    if (useSheetForItem()) { state.selected = id; openOverlay({ kind: 'item', id }); }
    else { state.selected = state.selected === id ? null : id; if (state.view !== 'fridge') go('fridge'); else render(); }
  },
  deselect: () => { state.selected = null; render(); },
  'close-overlay': () => closeOverlay(),
  filter: el => { state.filter = el.dataset.f; render(); },
  'filter-haunts': () => { state.filter = 'haunts'; state.q = ''; if (state.view !== 'fridge') go('fridge'); else render(); },
  use: el => useItem(el.dataset.id, 1),
  half: el => useItem(el.dataset.id, 0.5),
  discard: el => discardItem(el.dataset.id),
  'bury-all': () => openOverlay({ kind: 'bury' }),
  'bury-confirm': () => buryAll(),
  manual: () => startManual(),
  sample: el => requestScan({ sample: +el.dataset.i }),
  'notice-gemini': () => { const p = state.overlay.pending; state.settings.aiNoticeSeen = true; state.overlay = null; startScan(p); },
  'notice-tess': () => { const p = state.overlay.pending; Object.assign(state.settings, { aiNoticeSeen: true, tesseractOnly: true }); state.overlay = null; startScan(p); },
  'pick-currency': el => openOverlay({ kind: 'currency', target: el.dataset.target }),
  'set-currency': el => setCurrency(el.dataset.code),
  'add-line': () => { state.draft.lines.push(blankLine()); render(); const ins = document.querySelectorAll('.l-name input'); ins[ins.length - 1]?.focus(); },
  'del-line': el => { state.draft.lines = state.draft.lines.filter(l => l.id !== el.dataset.id); render(); },
  'cancel-scan': () => { state.draft = null; state.scanStep = 'pick'; render(); toast('Scan discarded. Nothing was added.'); },
  'confirm-scan': () => confirmScan(),
  summon: () => summon(),
  'toggle-veg': () => { state.settings.vegetarian = !state.settings.vegetarian; if (state.recipes) state.recipes = generateRecipes(); render(); },
  cook: el => openOverlay({ kind: 'cook', i: +el.dataset.i }),
  'cook-confirm': el => cookRecipe(+el.dataset.i),
  reset: () => { seed(); render(); toast('Demo data reset'); },
};
app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || !app.contains(el) || el.disabled) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});
app.addEventListener('input', e => {
  const el = e.target, kind = el.dataset.input;
  if (kind === 'search') { state.q = el.value; $('#fridgeZones').innerHTML = fridgeHTML(); }
  else if (kind === 'cur-search') $('#curList').innerHTML = curListHTML(state.overlay, el.value);
  else if (kind === 'line') onLineInput(el);
});

app.addEventListener('change', e => {
  const el = e.target, kind = el.dataset.input;
  if (kind === 'file') { handleFile(el.files && el.files[0]); el.value = ''; }
  else if (kind === 'draft-date') { if (parseIso(el.value)) state.draft.date = el.value; }
  else if (kind === 'expiry') {
    const it = byId(el.dataset.id), d = parseIso(el.value);
    if (!it || !d) return;
    Object.assign(it, { expires: d, expirySource: 'user', shelfDays: Math.max(1, daysBetween(it.purchased, d)) });
    render();
    toast(`${it.name} now ${STAGES[stageOf(it)].label.toLowerCase()} · ${remText(daysLeft(it)).toLowerCase()}`);
  } else if (kind === 'setting') {
    state.settings[el.dataset.k] = el.checked;
    if (el.dataset.k === 'vegetarian' && state.recipes) state.recipes = generateRecipes();
    render();
    const again = $(`[data-k="${el.dataset.k}"]`); if (again) again.focus();
  }
});
function onLineInput(el) {
  const row = el.closest('[data-line]'), l = state.draft.lines.find(x => x.id === row.dataset.line), f = el.dataset.f;
  if (!l) return;
  if (f === 'include') { l.include = el.checked; row.classList.toggle('excluded', !l.include); }
  else if (f === 'qty') l.qty = Math.max(0, parseInt(el.value, 10) || 0);
  else if (f === 'price') l.price = el.value === '' ? NaN : parseFloat(el.value);
  else if (f === 'category') l.category = el.value;
  else if (f === 'name') {
    l.name = el.value;
    const c = lookup(l.name);
    if (c) { l.category = c.cat; row.querySelector('[data-f="category"]').value = c.cat; }
  }
  const t = $('#draftTotal'); if (t) t.textContent = draftTotal();
}
/* Drag and drop onto the scan dropzone */
app.addEventListener('dragover', e => { const z = e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('drag'); } });
app.addEventListener('dragleave', e => { const z = e.target.closest('[data-drop]'); if (z) z.classList.remove('drag'); });
app.addEventListener('drop', e => {
  const z = e.target.closest('[data-drop]'); if (!z) return;
  e.preventDefault(); z.classList.remove('drag');
  handleFile(e.dataTransfer.files && e.dataTransfer.files[0]);
});
/* Escape = back for overlays / details. Simple focus trap inside dialogs. */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (state.overlay || (state.selected && hasSide()))) { e.preventDefault(); back(); }
  if (e.key === 'Tab' && state.overlay) {
    const f = [...document.querySelectorAll('.ov button, .ov input, .ov select, .ov summary')].filter(x => !x.disabled);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});
$('#androidBack').addEventListener('click', back);
document.querySelectorAll('#previewbar [data-device]').forEach(b => b.addEventListener('click', () => { device = b.dataset.device; applyDevice(); }));
let layoutKey = '';
window.addEventListener('resize', () => {
  const k = `${isPhone()}|${hasSide()}|${isNarrow()}`;
  if (k !== layoutKey) { layoutKey = k; applyDevice(); }
});
const tickClock = () => { $('#clock').textContent = new Date().toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' }); };
setInterval(tickClock, 30000); tickClock();

seed();
layoutKey = `${isPhone()}|${hasSide()}|${isNarrow()}`;
applyDevice();
})();
