/**
 * Records real TheMealDB recipes for the app's offline demo mode (apps/mobile/lib/demo/recipes.json).
 * Run again to refresh: `cd apps/api && npx tsx scripts/record-demo-recipes.mts`.
 * Uses TheMealDB's free test key and parses meals exactly as the server does.
 */
import { writeFileSync } from 'node:fs';
import { parseMeal } from '../src/mealdb.js';

// Chosen to use the sample fridge's turning food (spinach, strawberries, avocado, mushrooms, milk, chicken)
// and the sample receipt's (milk, eggs, chicken, spinach, strawberries, bananas, yogurt, carrots).
const IDS = ['53219', '52849', '52846', '52791', '53082', '52855', '53473', '52853', '53107', '52955', '52775', '52850'];

const out = [];
for (const id of IDS) {
  const res = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`, { signal: AbortSignal.timeout(15_000) });
  const body = (await res.json()) as { meals?: Record<string, unknown>[] | null };
  const meal = body.meals?.[0];
  if (!meal) throw new Error(`TheMealDB has no meal ${id}`);
  const m = parseMeal(meal);
  // Thumbnails need the internet; the demo shows the category icon when they can't load.
  out.push({ ...m, recordedAt: new Date().toISOString().slice(0, 10) });
}
const target = new URL('../../mobile/lib/demo/recipes.json', import.meta.url);
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`Recorded ${out.length} recipes to ${target.pathname}`);
