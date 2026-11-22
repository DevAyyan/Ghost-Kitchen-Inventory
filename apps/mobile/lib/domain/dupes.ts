import type { DraftLine } from './draft';
import { daysLeft, remainingText } from './expiry';
import { foodKey } from './learning';
import type { IsoDate, Item } from './types';

/** Heads-up shown on a review row: food of the same kind is already in the fridge. */
export interface Duplicate {
  name: string;
  zone: Item['zone'];
  /** "3 days left", "Expired 1 day ago": what is known about the one already there. */
  remaining: string;
}

/**
 * Which rows of a draft match food that is already stocked, by foodKey ("Baby Spinach" matches "spinach").
 * Only a warning: buying a second pack can be on purpose, so it never blocks stocking. Where several items
 * match, the one that goes off first is named, since that is the one to use before the new one.
 */
export function findDuplicates(lines: DraftLine[], items: Item[], now?: IsoDate): Map<string, Duplicate> {
  const byKey = new Map<string, Item>();
  for (const it of items) {
    if (it.status !== 'active' || it.fraction <= 0) continue;
    const key = foodKey(it.name);
    if (!key) continue;
    const seen = byKey.get(key);
    if (!seen || it.expires < seen.expires) byKey.set(key, it);
  }
  const out = new Map<string, Duplicate>();
  for (const l of lines) {
    if (!l.include || l.nonFood) continue;
    const key = foodKey(l.name);
    if (!key) continue;
    const hit = byKey.get(key);
    if (hit) out.set(l.id, { name: hit.name, zone: hit.zone, remaining: remainingText(daysLeft(hit, now)) });
  }
  return out;
}
