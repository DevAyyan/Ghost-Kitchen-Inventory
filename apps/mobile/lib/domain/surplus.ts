import { HIGH_RISK_CATEGORIES } from './catalog';
import { shortDate } from './dates';
import { stageOf } from './expiry';
import type { IsoDate, Item } from './types';
import { formatQty } from './units';

/**
 * Whether an item can be offered to neighbours or a community fridge. Only low-risk food that hasn't
 * passed its date: meat, fish, dairy, eggs and leftovers are never offered, whatever their date.
 */
export function canOffer(item: Item, now: IsoDate): boolean {
  if (item.status !== 'active' || item.fraction <= 0) return false;
  if (item.highRisk || HIGH_RISK_CATEGORIES.has(item.category)) return false;
  const s = stageOf(item, now);
  return s === 'fresh' || s === 'aging' || s === 'expiring';
}

/**
 * A short message offering the food. States the date and whether it's only an estimate, and asks the
 * person taking it to check it: it never says the food is safe.
 */
export function offerText(item: Item, now: IsoDate): string {
  const left = item.qty * item.fraction;
  const amount = item.unit === 'pcs' ? (left === 1 ? '' : `${Math.round(left * 10) / 10} × `) : `${formatQty(left, item.unit)} `;
  const date = `${item.expiryConfirmed ? 'best by' : 'roughly good until'} ${shortDate(item.expires)}`;
  const opened = item.fraction < 1 ? ' (opened)' : '';
  return [
    `👻 Free to a good home: ${amount}${item.name}${opened}, ${date}.`,
    'Rescuing it from my haunted kitchen before it turns. Please check it looks and smells fine before you eat it.',
    stageOf(item, now) === 'expiring' ? 'Best used in the next day or two.' : '',
  ].filter(Boolean).join('\n');
}
