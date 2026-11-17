import { CATEGORY_FALLBACK, HIGH_RISK_CATEGORIES } from './catalog';
import { addDays, daysBetween, today } from './dates';
import type { ProductInfo } from './product-info';
import type { Category, ExpirySource, IsoDate, Item, Life, Stage, Unit, Zone } from './types';

/** Expiry engine (SDS section 4). `now` is injectable for tests. */
export function daysLeft(item: Pick<Item, 'expires'>, now: IsoDate = today()): number {
  return daysBetween(now, item.expires);
}

export function stageOf(item: Pick<Item, 'expires' | 'shelfDays' | 'highRisk'>, now: IsoDate = today()): Stage {
  const rem = daysLeft(item, now);
  const total = Math.max(1, item.shelfDays);
  if (rem < 0 && item.highRisk) return 'spoiled'; // high-risk food never "rots", it is unsafe
  if (rem < -3) return 'spoiled';
  if (rem < 0) return 'rotting';
  if (rem <= 2 || rem / total <= 0.25) return 'expiring';
  if (rem / total <= 0.5) return 'aging';
  return 'fresh';
}

/** Food that may go into a recipe. Spoiled food and rotting high-risk food never do. */
export function isCookable(item: Item, now: IsoDate = today()): boolean {
  const s = stageOf(item, now);
  return s !== 'spoiled' && !(s === 'rotting' && item.highRisk);
}

export const isAtRisk = (s: Stage) => s === 'expiring' || s === 'rotting';
export const isHaunting = (s: Stage) => s === 'expiring' || s === 'rotting' || s === 'spoiled';

export function remainingText(rem: number): string {
  if (rem > 1) return `${rem} days left`;
  if (rem === 1) return '1 day left';
  if (rem === 0) return 'Expires today';
  if (rem === -1) return 'Expired 1 day ago';
  return `Expired ${-rem} days ago`;
}

export function shortRemaining(rem: number): string {
  if (rem > 0) return `${rem}d left`;
  if (rem === 0) return 'today';
  return `${-rem}d over`;
}

/** Food-safety guidance shown in item details. Advisory only. */
export function safetyAdvice(item: Item, stage: Stage): { tone: 'warning' | 'danger'; text: string } | null {
  if (stage === 'spoiled' && item.highRisk) {
    return { tone: 'danger', text: `This ${item.category} is past its safe window. Don't taste-test it. Discard it.` };
  }
  if (stage === 'spoiled') return { tone: 'danger', text: 'This has most likely gone bad. Compost or discard it.' };
  if (stage === 'rotting') {
    return { tone: 'warning', text: 'Use today only if it still looks and smells fine. Trim soft spots; discard anything moldy.' };
  }
  if (stage === 'expiring' && item.highRisk) return { tone: 'warning', text: 'Cook it today and cook it through.' };
  if (stage === 'expiring') return { tone: 'warning', text: 'Use it in the next day or two.' };
  return null;
}

let seq = 0;
/** Random tail: devices in a shared household create ids independently and must not collide. */
export const newId = (prefix = 'i') =>
  `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The "sniff test": the user checked a food that is at or past its date and it still looks, smells and
 * feels fine, so it gets a little longer before we nag again. Food-safety limits:
 * - never for high-risk food (meat, fish, eggs, dairy, leftovers): past its date it stays spoiled;
 * - only once the date is a day away or past, and never once spoiled;
 * - SNIFF_DAYS from today, so the item stays "expiring" (2 days or less) and never looks fresh again;
 * - at most MAX_SNIFFS times per item.
 */
export const SNIFF_DAYS = 2;
export const MAX_SNIFFS = 2;

export type SniffCheck = { ok: true } | { ok: false; reason: 'high-risk' | 'too-early' | 'spoiled' | 'used-up' };

export function sniffCheck(item: Item, now: IsoDate = today()): SniffCheck {
  if (item.highRisk || HIGH_RISK_CATEGORIES.has(item.category)) return { ok: false, reason: 'high-risk' };
  const stage = stageOf(item, now);
  if (stage === 'spoiled') return { ok: false, reason: 'spoiled' };
  if ((item.sniffs ?? 0) >= MAX_SNIFFS) return { ok: false, reason: 'used-up' };
  if (daysLeft(item, now) >= SNIFF_DAYS) return { ok: false, reason: 'too-early' };
  return { ok: true };
}

/** The item after a passed check, or null when the check isn't allowed. */
export function afterSniff(item: Item, now: IsoDate = today()): Item | null {
  if (!sniffCheck(item, now).ok) return null;
  const expires = addDays(now, SNIFF_DAYS);
  return {
    ...item, expires, expirySource: 'sniff', expiryConfirmed: true, sniffs: (item.sniffs ?? 0) + 1,
    shelfDays: Math.max(1, daysBetween(item.purchased, expires)),
  };
}

/** Shelf life per section: Gemini's answer if we have one, else the conservative category fallback. */
export function lifeOf(category: Category, info?: ProductInfo | null, stored?: Life): Life {
  return info?.shelfLifeDays ?? stored ?? CATEGORY_FALLBACK[category].life;
}

/** Where an item normally goes. */
export function homeZone(category: Category, info?: ProductInfo | null): Zone {
  return info?.homeZone ?? CATEGORY_FALLBACK[category].home;
}

/**
 * Estimated expiry for a new item stored in `zone` (default: its usual section).
 * If that section is unsuitable (null), the usual section's figure is used.
 */
export function estimateExpiry(category: Category, purchased: IsoDate, zone?: Zone, info?: ProductInfo | null) {
  const life = lifeOf(info?.category ?? category, info);
  const home = homeZone(info?.category ?? category, info);
  const z = zone ?? home;
  const shelfDays = life[z] ?? life[home] ?? 3;
  return {
    expires: addDays(purchased, shelfDays),
    shelfDays,
    source: (info ? 'model' : 'category') as ExpirySource,
  };
}

export function makeItem(input: {
  name: string; category?: Category; qty?: number; unit?: Unit; priceMinor: number;
  currency: string; purchased: IsoDate;
  /** Date the user confirmed (or typed from the package). Overrides the estimate. */
  expires?: IsoDate; expiryConfirmed?: boolean; expirySource?: ExpirySource; photoUri?: string;
  zone?: Zone; info?: ProductInfo | null;
}): Item {
  const info = input.info ?? null;
  const category = info?.category ?? input.category ?? 'other';
  const zone = input.zone ?? homeZone(category, info);
  const est = estimateExpiry(category, input.purchased, zone, info);
  const expires = input.expires ?? est.expires;
  return {
    id: newId(),
    name: input.name.trim(),
    photoUri: input.photoUri,
    category,
    zone,
    home: homeZone(category, info),
    // The category floor applies even if the model said otherwise.
    highRisk: (info?.highRisk ?? false) || HIGH_RISK_CATEGORIES.has(category),
    qty: input.qty && input.qty > 0 ? input.qty : 1,
    unit: input.unit ?? 'pcs',
    // Last line of defence: a stored price is never negative, whatever the caller passed.
    priceMinor: Number.isFinite(input.priceMinor) ? Math.max(0, Math.round(input.priceMinor)) : 0,
    currency: input.currency,
    purchased: input.purchased,
    expires,
    // Total shelf life drives the stage ratios, so keep it consistent with the chosen date.
    shelfDays: Math.max(1, daysBetween(input.purchased, expires)),
    expirySource: input.expirySource ?? est.source,
    expiryConfirmed: input.expiryConfirmed ?? false,
    status: 'active',
    fraction: 1,
    life: info?.shelfLifeDays,
    multiUse: info?.multiUse,
    tip: info?.tip || undefined,
  };
}

export const EXPIRY_SOURCE_LABEL: Record<ExpirySource, string> = {
  model: 'Estimated by Gemini from typical shelf life',
  category: 'Rough estimate for this kind of food (AI was unavailable)',
  user: 'Set by you',
  learned: 'Shortened: this household has thrown this food out early before',
  sniff: 'Pushed back after you checked it. Check again before eating',
  package: 'Read from the date printed on the pack. Check it matches.',
  default: 'Estimated from typical shelf life',
};
