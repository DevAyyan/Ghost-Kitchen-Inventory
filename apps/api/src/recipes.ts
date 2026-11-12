import { z } from 'zod';
import { isStaple, sameIngredient } from './match.js';
import type { MealDb, MealDetail } from './mealdb.js';
import { productKey, type ProductService } from './products.js';
import { DIET_EXCLUDES, Diet, type Tag } from './schemas.js';

export const SuggestRequest = z.object({
  items: z.array(z.object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(80),
    /** 1 fresh, 2 aging, 3 expiring, 4 rotting. The client never sends spoiled or unsafe food. */
    urgency: z.number().min(1).max(4),
  })).max(300),
  diets: z.array(Diet).max(10).default([]),
  /** Recipes per page. */
  limit: z.number().int().min(1).max(10).default(10),
  /** 1-based page of the ranked list. Pages are stable for the same fridge and diets. */
  page: z.number().int().min(1).max(20).default(1),
  useAi: z.boolean().default(true),
});
export type SuggestRequest = Omit<z.infer<typeof SuggestRequest>, 'page'> & { page?: number };

export interface RecipeIngredient {
  name: string; measure: string; staple: boolean; inStock: boolean;
  /** The fridge item that covers it. */
  itemId: string | null;
}

export interface Recipe {
  id: string; title: string; category: string | null; area: string | null; tags: string[];
  thumb: string | null; youtube: string | null; sourceUrl: string; steps: string[];
  ingredients: RecipeIngredient[];
  /** Fridge items (aging or worse) this recipe uses up. */
  rescuesItemIds: string[];
  missing: string[];
  score: number;
}

export interface SuggestResult {
  recipes: Recipe[];
  warnings: string[];
  /** `total` recipes in the full ranking; `pages` = ceil(total / limit). */
  page: { number: number; size: number; total: number; pages: number };
  meta: { seeds: string[]; unmatchedSeeds: string[]; candidates: number };
}

const SEEDS = 6;
/**
 * Meals considered per request, whatever the page. The whole pool is ranked and each page is a slice of
 * that ranking, so the same fridge always gives the same pages (going back shows the same recipes).
 * Details are cached for a day, so after the first page, the rest cost no TheMealDB calls.
 */
const POOL = 60;

export function createRecipeService(mealdb: MealDb, products: ProductService) {
  return {
    async suggest(req: SuggestRequest): Promise<SuggestResult> {
      const warnings: string[] = [];
      const weight = (u: number) => u * u;
      const pageNo = req.page ?? 1;
      const empty = (total = 0) => ({ number: pageNo, size: req.limit, total, pages: Math.ceil(total / req.limit) });
      const seedsWanted = [...req.items].filter((i) => i.urgency >= 2).sort((a, b) => b.urgency - a.urgency).slice(0, SEEDS);
      if (seedsWanted.length === 0) {
        return { recipes: [], warnings: ['Nothing is close to turning, so there is nothing urgent to rescue.'], page: empty(), meta: { seeds: [], unmatchedSeeds: [], candidates: 0 } };
      }

      // 1. Map fridge items to TheMealDB ingredient names.
      const names = await mealdb.ingredientNames();
      // TheMealDB lists variants ("Tomatoes", "Chopped Tomatoes"), so a fridge item may match several.
      const seeds: { item: (typeof seedsWanted)[number]; mealNames: string[] }[] = [];
      const unmatchedSeeds: string[] = [];
      for (const item of seedsWanted) {
        const mealNames = names.filter((n) => sameIngredient(n, item.name));
        if (mealNames.length > 0) seeds.push({ item, mealNames }); else unmatchedSeeds.push(item.name);
      }
      if (seeds.length === 0) {
        return { recipes: [], warnings: ['TheMealDB has no recipes for those ingredients.'], page: empty(), meta: { seeds: [], unmatchedSeeds, candidates: 0 } };
      }

      // 2. Meals that use at least one seed; prefer the ones that use the most urgent food.
      const hits = new Map<string, number>();
      await Promise.all(seeds.map(async ({ item, mealNames }) => {
        const found = new Set<string>();
        for (const meals of await Promise.all(mealNames.map((n) => mealdb.byIngredient(n)))) meals.forEach((m) => found.add(m.id));
        for (const id of found) hits.set(id, (hits.get(id) ?? 0) + weight(item.urgency));
      }));
      const ids = [...hits.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, POOL).map(([id]) => id);
      const details = (await Promise.all(ids.map((id) => mealdb.detail(id).catch(() => null)))).filter((m): m is MealDetail => !!m);

      // 3. Diets: every non-staple ingredient must be known and clear of excluded tags. Unknown means no.
      let allowed = details;
      if (req.diets.length > 0) {
        const banned = new Set<Tag>(req.diets.flatMap((d) => DIET_EXCLUDES[d]));
        const wanted = [...new Set(details.flatMap((m) => m.ingredients.map((i) => i.name)).filter((n) => !isStaple(n)))];
        const lookup = await products.lookup(wanted, { useAi: req.useAi });
        const verdict = (name: string) => {
          const info = lookup.products.get(productKey(name));
          return info ? !info.tags.some((t) => banned.has(t)) : null;
        };
        allowed = details.filter((m) => m.ingredients.every((i) => isStaple(i.name) || verdict(i.name) === true));
        if (lookup.ai !== 'ok' && allowed.length < details.length) {
          warnings.push(
            lookup.ai === 'skipped' || lookup.ai === 'disabled'
              ? 'Diet filters need AI to check ingredients, so recipes that could not be checked are hidden.'
              : 'Some ingredients could not be checked against your diet, so those recipes are hidden.'
          );
        }
      }

      // 4. Score against everything in the fridge, not just the seeds.
      const urgency = new Map(req.items.map((i) => [i.id, i.urgency]));
      const scored: Recipe[] = allowed.map((m) => {
        const ingredients: RecipeIngredient[] = m.ingredients.map((ing) => {
          if (isStaple(ing.name)) return { ...ing, staple: true, inStock: true, itemId: null };
          const match = req.items.filter((i) => sameIngredient(i.name, ing.name)).sort((a, b) => b.urgency - a.urgency)[0];
          return { ...ing, staple: false, inStock: !!match, itemId: match?.id ?? null };
        });
        const rescues = [...new Set(ingredients.flatMap((i) => (i.itemId && (urgency.get(i.itemId) ?? 0) >= 2 ? [i.itemId] : [])))];
        const missing = ingredients.filter((i) => !i.staple && !i.inStock).map((i) => i.name);
        return {
          id: m.id, title: m.title, category: m.category, area: m.area, tags: m.tags,
          thumb: m.thumb ? `${m.thumb}/medium` : null, youtube: m.youtube, sourceUrl: m.sourceUrl, steps: m.steps,
          ingredients, rescuesItemIds: rescues, missing, score: 0,
        };
      }).filter((r) => r.rescuesItemIds.length > 0);

      // 5. Rank the whole pool greedily: reward urgent food, penalise shopping, discount food an earlier
      //    pick already rescues (so each page covers different food). Then hand out one page of it.
      const picked: Recipe[] = [];
      const covered = new Set<string>();
      while (picked.length < scored.length) {
        let best: Recipe | null = null;
        for (const r of scored) {
          if (picked.includes(r)) continue;
          r.score = r.rescuesItemIds.reduce((a, id) => a + (covered.has(id) ? 0.3 : 1) * weight(urgency.get(id) ?? 1), 0) - 1.5 * r.missing.length;
          if (!best || r.score > best.score || (r.score === best.score && r.id < best.id)) best = r;
        }
        if (!best) break;
        picked.push(best);
        best.rescuesItemIds.forEach((id) => covered.add(id));
      }
      if (picked.length === 0 && warnings.length === 0) warnings.push('No recipe matched what you have. Try fewer filters, or add more groceries.');
      const start = (pageNo - 1) * req.limit;
      return {
        recipes: picked.slice(start, start + req.limit),
        warnings,
        page: empty(picked.length),
        meta: { seeds: seeds.map((s) => s.item.name), unmatchedSeeds, candidates: details.length },
      };
    },
  };
}
export type RecipeService = ReturnType<typeof createRecipeService>;
