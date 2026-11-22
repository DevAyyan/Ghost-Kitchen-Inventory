import { daysLeft, isCookable, remainingText, stageOf } from './expiry';
import { addDays } from './dates';
import { foodKey } from './learning';
import type { IsoDate, Item, ItemEvent, PlanEntry, ShoppingItem } from './types';

/** Loose match for "do I already have this?": case, spacing and simple plurals don't matter. */
export function sameFood(a: string, b: string): boolean {
  const norm = (s: string) =>
    foodKey(s).split(' ').map((w) => (w.length > 3 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith('oes') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');
  return norm(a) === norm(b);
}

/** Active fridge items with this name, so the list can say "you still have 2". */
export const inStock = (name: string, items: Item[]) => items.filter((i) => i.status === 'active' && sameFood(i.name, name));

const onList = (name: string, list: ShoppingItem[]) => list.some((s) => !s.checked && sameFood(s.name, name));

/** Adds a line unless the same food is already waiting on the list. */
export function addToList(list: ShoppingItem[], line: ShoppingItem): ShoppingItem[] {
  if (!line.name.trim() || onList(line.name, list)) return list;
  return [line, ...list];
}

/** Things the household finished recently and hasn't got any more of. */
export function usedUpSuggestions(events: ItemEvent[], items: Item[], list: ShoppingItem[], now: IsoDate, days = 14): string[] {
  const since = addDays(now, -days);
  const out: string[] = [];
  for (const e of events) {
    if (e.type !== 'used' || !e.finished || e.date < since) continue;
    if (out.some((n) => sameFood(n, e.name)) || onList(e.name, list) || inStock(e.name, items).length) continue;
    out.push(e.name);
  }
  return out.slice(0, 12);
}

export interface Missing { name: string; measure: string; meals: string[] }

/** Non-staple ingredients of upcoming, uncooked meals that aren't in the fridge or on the list. */
export function missingForPlan(plan: PlanEntry[], items: Item[], list: ShoppingItem[], now: IsoDate): Missing[] {
  const out: Missing[] = [];
  for (const p of plan) {
    if (p.cooked || p.date < now) continue;
    for (const ing of p.ingredients) {
      if (ing.staple || inStock(ing.name, items).length || onList(ing.name, list)) continue;
      const prev = out.find((m) => sameFood(m.name, ing.name));
      if (prev) { if (!prev.meals.includes(p.title)) prev.meals.push(p.title); continue; }
      out.push({ name: ing.name, measure: ing.measure, meals: [p.title] });
    }
  }
  return out;
}

/** The list as plain text for sharing: what's still to buy, one per line, with amounts. Ticked lines are left out. */
export function shoppingText(list: ShoppingItem[]): string {
  const open = list.filter((l) => !l.checked);
  return ['Shopping list', ...open.map((l) => `- ${l.name}${l.amount ? ` (${l.amount})` : ''}`)].join('\n');
}

/**
 * Stock of this food that is turning (aging or worse but still cookable), soonest first: buying more now
 * would only add to what goes off. Spoiled stock isn't offered as an alternative to buying.
 */
export function turningStock(name: string, items: Item[], now: IsoDate): Item[] {
  return inStock(name, items)
    .filter((i) => i.fraction > 0 && isCookable(i, now) && stageOf(i, now) !== 'fresh')
    .sort((a, b) => a.expires.localeCompare(b.expires));
}

/** Plain heads-up for a shopping line, or null. Never says the food is safe, only how long is left. */
export function turningNote(name: string, items: Item[], now: IsoDate): string | null {
  const t = turningStock(name, items, now)[0];
  return t ? `Use yours first: ${t.name}, ${remainingText(daysLeft(t, now)).toLowerCase()}.` : null;
}
