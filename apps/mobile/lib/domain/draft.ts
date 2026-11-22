import { resolveCurrency, toMinor } from '@/lib/currency/money';
import { addDays, daysBetween } from './dates';
import { CATEGORIES } from './catalog';
import { estimateExpiry, homeZone, newId } from './expiry';
import { foodKey, learnedShelfDays, type Learned } from './learning';
import type { ProductInfo } from './product-info';
import type { Category, ExpirySource, IsoDate, Zone } from './types';
import { isUnit, type Unit } from './units';

/** An editable receipt line on the review screen. `price` is a string so typing "4." works. */
export interface DraftLine {
  id: string;
  raw: string;
  name: string;
  /** Amount as typed, so "0." or "1.5" can be entered; parsed with parseQty. */
  qty: string;
  unit: Unit;
  price: string;
  category: Category;
  confidence: number;
  include: boolean;
  nonFood: boolean;
  manual: boolean;
  /** Estimated until the user confirms or adjusts it (FR-EXP-7). */
  expires: IsoDate;
  expirySource: ExpirySource;
  expiryConfirmed: boolean;
  photoUri?: string;
  /** Where it will be stored; changes the estimate (e.g. meat going straight into the freezer). */
  zone: Zone;
  /** Gemini's storage facts for this name; undefined = not looked up yet, null = unknown. */
  info?: ProductInfo | null;
  /**
   * Identified from a photo of the item, so we don't know when it was bought. Without a printed date, its
   * estimate counts only half the usual shelf life: guessing too late is the unsafe mistake.
   */
  fromPhoto?: boolean;
}

export interface Draft {
  store: string;
  date: IsoDate;
  currency: string;
  currencyConfidence: number;
  currencySource: 'detected' | 'default' | 'user';
  evidence: string[];
  candidates?: string[];
  subtotal: number | null;
  source: 'gemini' | 'rules' | 'manual' | 'photo';
  warnings: string[];
  lines: DraftLine[];
}

export const LOW_CONFIDENCE = 0.7;
export const CURRENCY_CHECK_THRESHOLD = 0.8;

/** Lines that become fridge items, and so need a confirmed expiry date. */
export const needsExpiry = (l: DraftLine) => l.include && !l.nonFood && l.name.trim() !== '';

/** What the learning loop knows, keyed by foodKey (see learning.ts). */
export type Lessons = Map<string, Learned>;

/**
 * Re-estimate an unconfirmed line (after a name, category, section or info change). Confirmed dates and
 * dates printed on the pack are kept. `lessons` can only shorten the estimate.
 */
export function reestimate(line: DraftLine, purchased: IsoDate, lessons?: Lessons): Pick<DraftLine, 'expires' | 'expirySource'> {
  if (line.expiryConfirmed || line.expirySource === 'package') return { expires: line.expires, expirySource: line.expirySource };
  const est = estimateExpiry(line.category, purchased, line.zone, line.info);
  const expires = line.fromPhoto ? halveFromToday(purchased, est.expires) : est.expires;
  const days = daysBetween(purchased, expires);
  const shorter = learnedShelfDays(days, lessons?.get(foodKey(line.name)));
  if (shorter < days) return { expires: addDays(purchased, shorter), expirySource: 'learned' };
  return { expires, expirySource: est.source };
}

/** Applies what the household has learned to every estimated line of a draft. */
export function applyLessons(draft: Draft, lessons: Lessons): Draft {
  if (lessons.size === 0) return draft;
  return { ...draft, lines: draft.lines.map((l) => (needsExpiry(l) ? { ...l, ...reestimate(l, draft.date, lessons) } : l)) };
}

/** Half of the remaining shelf life, at least one day. */
function halveFromToday(purchased: IsoDate, expires: IsoDate): IsoDate {
  return addDays(purchased, Math.max(1, Math.floor(daysBetween(purchased, expires) / 2)));
}

/** Applies Gemini facts to a line: category, usual section and the estimate (unless the user already chose). */
export function withInfo(line: DraftLine, info: ProductInfo | null, purchased: IsoDate, lessons?: Lessons): DraftLine {
  if (!info) return { ...line, info: null, ...reestimate(line, purchased, lessons) };
  const category = line.manual && line.category !== BLANK_CATEGORY ? line.category : info.category;
  const next: DraftLine = { ...line, info, category, zone: line.expiryConfirmed ? line.zone : info.homeZone };
  return { ...next, ...reestimate(next, purchased, lessons) };
}

/** Raw scan result from POST /v1/receipts/scan. */
export interface ScanInput {
  store: string | null;
  date: string | null;
  currency: { code: string | null; symbol: string | null; confidence: number; evidence: string[] };
  subtotal: number | null;
  lines: { raw: string; name: string; quantity: number; unit?: string; price: number; category: string; isFood: boolean; confidence: number }[];
  source: 'gemini' | 'rules';
  warnings: string[];
}

const asCategory = (c: string): Category => ((CATEGORIES as string[]).includes(c) ? (c as Category) : 'other');

export function draftFromScan(
  s: ScanInput,
  opts: { defaultCurrency: string; storeHint?: string; date: IsoDate }
): Draft {
  const symbol = s.currency.symbol?.replace(/\.$/, '') || undefined;
  const cur = resolveCurrency(
    { code: s.currency.code ?? undefined, symbol, confidence: s.currency.confidence, evidence: s.currency.evidence },
    opts.defaultCurrency,
    s.store ? opts.storeHint : undefined
  );
  const purchased = s.date && s.date <= opts.date ? s.date : opts.date;
  return {
    store: s.store?.trim() || 'Receipt',
    date: purchased,
    currency: cur.code,
    currencyConfidence: cur.confidence,
    currencySource: cur.source,
    evidence: cur.evidence,
    candidates: cur.candidates,
    subtotal: s.subtotal,
    source: s.source,
    warnings: s.warnings,
    lines: s.lines.map((l) => {
      const category = asCategory(l.category);
      const zone = homeZone(category);
      const est = estimateExpiry(category, purchased, zone);
      return {
        id: newId('l'), raw: l.raw, name: l.name, ...scannedQty(l.quantity, l.unit), price: String(Number.isFinite(l.price) && l.price > 0 ? l.price : 0),
        category, confidence: l.confidence, include: l.isFood, nonFood: !l.isFood, manual: false, zone,
        expires: est.expires, expirySource: est.source, expiryConfirmed: false,
      };
    }),
  };
}

/**
 * A draft from a photo of one item: no price, no receipt. A date printed on the pack is used as is; without
 * one, the estimate assumes the food is already part-way through its life.
 */
export function draftFromItemPhoto(
  s: { lines: { name: string; quantity: number; unit?: string; category: string; confidence: number; expires?: string | null }[]; warnings: string[] },
  opts: { currency: string; date: IsoDate; photoUri?: string }
): Draft {
  return {
    store: 'Item photo', date: opts.date, currency: opts.currency, currencyConfidence: 1, currencySource: 'default',
    evidence: [], subtotal: null, source: 'photo',
    warnings: s.warnings,
    lines: s.lines.map((l) => {
      const category = asCategory(l.category);
      const zone = homeZone(category);
      const est = estimateExpiry(category, opts.date, zone);
      const printed = l.expires && /^\d{4}-\d{2}-\d{2}$/.test(l.expires) ? l.expires : null;
      return {
        id: newId('l'), raw: '', name: l.name, ...scannedQty(l.quantity, l.unit), price: '0',
        category, confidence: l.confidence, include: true, nonFood: false, manual: false, zone,
        expires: printed ?? halveFromToday(opts.date, est.expires), expirySource: printed ? 'package' : est.source,
        expiryConfirmed: false, fromPhoto: true, photoUri: opts.photoUri,
      };
    }),
  };
}

/** Type a hand-added line starts with; until the user changes it, Gemini's answer replaces it. */
const BLANK_CATEGORY: Category = 'vegetable';

export function blankLine(purchased: IsoDate): DraftLine {
  const est = estimateExpiry(BLANK_CATEGORY, purchased, 'fridge');
  return {
    id: newId('l'), raw: '', name: '', qty: '1', unit: 'pcs', price: '', category: BLANK_CATEGORY,
    confidence: 1, include: true, nonFood: false, manual: true, zone: 'fridge',
    expires: est.expires, expirySource: est.source, expiryConfirmed: false,
  };
}

export function manualDraft(currency: string, date: IsoDate): Draft {
  return {
    store: 'Manual entry', date, currency, currencyConfidence: 1, currencySource: 'default',
    evidence: [], subtotal: null, source: 'manual', warnings: [], lines: [blankLine(date)],
  };
}

/**
 * A scanned barcode as a one-line hand-entry draft: the product's name, type and pack size filled in, the
 * price left for the user. Its date is a category estimate until the shelf-life lookup and the user check it.
 */
export function draftFromBarcode(
  p: { name: string; brand: string | null; category: string; qty: number | null; unit: string | null },
  opts: { currency: string; date: IsoDate }
): Draft {
  const category = asCategory(p.category);
  const zone = homeZone(category);
  const est = estimateExpiry(category, opts.date, zone);
  const line: DraftLine = {
    ...blankLine(opts.date),
    name: p.name, raw: p.brand ? `${p.brand} ${p.name}` : p.name, category, zone, manual: false,
    ...(p.qty !== null && isUnit(p.unit) ? scannedQty(p.qty, p.unit) : {}),
    expires: est.expires, expirySource: est.source,
  };
  return { ...manualDraft(opts.currency, opts.date), store: 'Barcode scan', lines: [line] };
}

/**
 * Price typed on a line. Empty means free (0): gifts, garden produce, leftovers. Anything that isn't a
 * plain number ("1.2.3") is NaN, so validateDraft can point it out instead of guessing.
 */
export const parsePrice = (s: string) => {
  const t = s.trim().replace(',', '.');
  if (t === '') return 0;
  return /^\d*\.?\d*$/.test(t) && t !== '.' ? Number(t) : NaN;
};

/** Amount typed on a line; invalid or empty means 1 so a line always becomes something sensible. */
export const parseQty = (s: string) => {
  const n = Number(s.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : NaN;
};

/** Receipt amount + unit: counted items round to whole pieces, weights and volumes keep decimals. */
function scannedQty(quantity: number, unit: string | undefined): { qty: string; unit: Unit } {
  const u: Unit = isUnit(unit) ? unit : 'pcs';
  const n = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  return { qty: String(u === 'pcs' ? Math.max(1, Math.round(n)) : Math.round(n * 1000) / 1000), unit: u };
}

export function draftTotals(d: Draft) {
  const sum = (lines: DraftLine[]) =>
    lines.reduce((a, l) => {
      const p = parsePrice(l.price);
      return a + (Number.isFinite(p) ? toMinor(p, d.currency) : 0);
    }, 0);
  const subtotalMinor = d.subtotal === null ? null : toMinor(d.subtotal, d.currency);
  const allMinor = sum(d.lines);
  const food = d.lines.filter(needsExpiry);
  return {
    totalMinor: sum(d.lines.filter((l) => l.include)),
    itemCount: food.length,
    expiryConfirmed: food.filter((l) => l.expiryConfirmed).length,
    mismatch: subtotalMinor !== null && allMinor !== subtotalMinor,
    allMinor,
    subtotalMinor,
  };
}

/** Returns an error message, or null when the draft can be committed. */
export function validateDraft(d: Draft): string | null {
  const lines = d.lines.filter((l) => l.include && l.name.trim());
  if (lines.length === 0) return 'Include at least one item with a name.';
  // A price of 0 (or left empty) is fine. Negative prices are never allowed.
  const prices = lines.map((l) => parsePrice(l.price));
  if (prices.some((p) => p < 0)) return "Prices can't be negative. Enter 0 if it was free.";
  if (prices.some((p) => !Number.isFinite(p))) return "One price isn't a number. Use digits, like 2.49, or leave it empty if it was free.";
  if (lines.some((l) => !l.nonFood && !Number.isFinite(parseQty(l.qty)))) return 'One amount is empty or zero. Enter how much you bought.';
  // Expiry dates are not required: unconfirmed ones stay marked "est." in the fridge until checked.
  return null;
}

/**
 * Rows worth a second look on review: a low-confidence reading, a date already past, or food that's
 * already stocked. Everything else can be confirmed as read.
 */
export function rowNeedsCheck(l: DraftLine, opts: { duplicate: boolean; now: IsoDate }): boolean {
  if (!l.include || l.nonFood) return false;
  if (!l.manual && l.confidence < LOW_CONFIDENCE) return true;
  if (l.name.trim() === '') return true;
  return opts.duplicate || daysBetween(opts.now, l.expires) < 0;
}

/** How many stocked rows go to each section, for the summary over the list. */
export function sectionCounts(lines: DraftLine[]): Record<Zone, number> {
  const out: Record<Zone, number> = { freezer: 0, fridge: 0, pantry: 0 };
  for (const l of lines) if (needsExpiry(l)) out[l.zone]++;
  return out;
}
