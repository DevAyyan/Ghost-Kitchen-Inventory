import { addDays, daysBetween } from './dates';
import { daysLeft, isCookable, stageOf } from './expiry';
import { sameFood } from './shopping';
import type { IsoDate, Item, PlanEntry } from './types';

/** How far ahead the planner looks. */
export const PLAN_DAYS = 7;

export const planDays = (from: IsoDate, n = PLAN_DAYS) => Array.from({ length: n }, (_, i) => addDays(from, i));

/** Does this uncooked meal use the item (linked directly, or by ingredient name)? */
function uses(p: PlanEntry, item: Item) {
  return p.itemIds.includes(item.id) || p.ingredients.some((g) => !g.staple && sameFood(g.name, item.name));
}

/**
 * Food that will turn before any planned meal uses it: cookable, at risk within the next 3 days, and not
 * in an uncooked meal planned on or before its date. These are the meals to plan next.
 */
export function unplannedAtRisk(items: Item[], plan: PlanEntry[], now: IsoDate): Item[] {
  return items
    .filter((i) => i.status === 'active' && isCookable(i, now) && stageOf(i, now) !== 'fresh' && daysLeft(i, now) <= 3)
    .filter((i) => !plan.some((p) => !p.cooked && p.date >= now && p.date <= i.expires && uses(p, i)))
    .sort((a, b) => a.expires.localeCompare(b.expires) || a.name.localeCompare(b.name));
}

export interface TooLate { entry: PlanEntry; item: Item; moveTo: IsoDate }

/**
 * Meals planned after an ingredient's date. Suggests the latest day that still works (never before today).
 * High-risk food past its date is unsafe, so this matters more than convenience.
 */
export function plannedTooLate(plan: PlanEntry[], items: Item[], now: IsoDate): TooLate[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: TooLate[] = [];
  for (const entry of plan) {
    if (entry.cooked || entry.date < now) continue;
    for (const id of entry.itemIds) {
      const item = byId.get(id);
      if (!item || item.status !== 'active' || item.expires >= entry.date) continue;
      out.push({ entry, item, moveTo: daysBetween(now, item.expires) >= 0 ? item.expires : now });
    }
  }
  return out;
}
