import { addDays } from './dates';
import { STAGE_META } from './catalog';
import { isAtRisk, isCookable, stageOf } from './expiry';
import type { Diet } from './diets';
import type { IsoDate, Item } from './types';

/** The server returns at most this many recipes per request (SuggestRequest.limit in apps/api/src/recipes.ts). */
export const PLAN_POOL = 10;

/**
 * The recipe search the 3-day plan makes: every cookable item, the best-first ranking (seed 0), one full
 * page. Only cookable food is sent, so spoiled food and rotting high-risk food never reach the server.
 */
export function rescueRequest(items: Item[], diets: Diet[], useAi: boolean, now: IsoDate) {
  const usable = items.filter((i) => i.status === 'active' && isCookable(i, now));
  return {
    usable,
    body: {
      items: usable.slice(0, 300).map((i) => ({ id: i.id, name: i.name, unit: i.unit, urgency: Math.max(1, STAGE_META[stageOf(i, now)].weight) })),
      diets, limit: PLAN_POOL, page: 1, seed: 0, seen: [] as string[], useAi,
    },
  };
}

/** What the planner needs from a recipe: which fridge items it uses, and what it's missing. */
export interface PlanCandidate {
  id: string;
  title: string;
  ingredients: { itemId: string | null }[];
  missing: string[];
}

export interface PlannedDay<R extends PlanCandidate> { date: IsoDate; recipe: R; covers: Item[] }

/**
 * A few days of meals that between them use as much of the turning food as possible: each pick is the
 * recipe that rescues the most not-yet-covered turning food (weighted by urgency, so expiring beats
 * aging), with fewer missing ingredients breaking ties. The meal whose food goes off first is cooked first.
 * Items must already be cookable (the caller never sends spoiled or rotting high-risk food).
 */
export function rescuePlan<R extends PlanCandidate>(recipes: R[], items: Item[], now: IsoDate, days = 3): PlannedDay<R>[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const weight = (i: Item) => {
    const s = stageOf(i, now);
    return isAtRisk(s) ? STAGE_META[s].weight * 2 : s === 'aging' ? STAGE_META.aging.weight : 0;
  };
  const covered = new Set<string>();
  const picks: { recipe: R; covers: Item[] }[] = [];
  const left = [...recipes];
  while (picks.length < days && left.length) {
    let best = -1, bestScore = 0;
    for (let n = 0; n < left.length; n++) {
      const uses = new Set(left[n]!.ingredients.flatMap((g) => (g.itemId && !covered.has(g.itemId) ? [g.itemId] : [])));
      const gain = [...uses].reduce((s, id) => s + (byId.get(id) ? weight(byId.get(id)!) : 0), 0);
      const score = gain * 10 - left[n]!.missing.length;
      if (gain > 0 && (best < 0 || score > bestScore)) { best = n; bestScore = score; }
    }
    if (best < 0) break;
    const recipe = left.splice(best, 1)[0]!;
    const covers = [...new Set(recipe.ingredients.flatMap((g) => (g.itemId ? [g.itemId] : [])))]
      .map((id) => byId.get(id)).filter((i): i is Item => !!i && !covered.has(i.id) && weight(i) > 0);
    covers.forEach((i) => covered.add(i.id));
    picks.push({ recipe, covers });
  }
  const soonest = (p: { covers: Item[] }) => p.covers.reduce((m, i) => (i.expires < m ? i.expires : m), '9999-12-31');
  return picks.sort((a, b) => soonest(a).localeCompare(soonest(b))).map((p, n) => ({ date: addDays(now, n), ...p }));
}
