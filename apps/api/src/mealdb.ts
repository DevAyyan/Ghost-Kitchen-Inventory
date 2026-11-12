export interface MealSummary { id: string; name: string }

export interface MealDetail {
  id: string;
  title: string;
  category: string | null;
  area: string | null;
  tags: string[];
  /** Photo URL; TheMealDB serves /small /medium /large variants. */
  thumb: string | null;
  youtube: string | null;
  steps: string[];
  ingredients: { name: string; measure: string }[];
  sourceUrl: string;
}

export interface MealDb {
  ingredientNames(): Promise<string[]>;
  byIngredient(name: string): Promise<MealSummary[]>;
  detail(id: string): Promise<MealDetail | null>;
}

const DAY = 24 * 60 * 60 * 1000;

/** Splits TheMealDB's free-text instructions into steps. */
export function splitSteps(instructions: string): string[] {
  const text = instructions.replace(/\r/g, '').trim();
  let parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    .filter((s) => !/^(step\s*)?\d+[.):]?$/i.test(s))
    .map((s) => s.replace(/^(step\s*)?\d+[.):]\s*/i, ''));
  if (parts.length <= 2 && text.length > 200) parts = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim());
  return parts.filter((s) => s.length >= 3).slice(0, 40);
}

const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function parseMeal(m: Record<string, unknown>): MealDetail {
  const ingredients: MealDetail['ingredients'] = [];
  for (let i = 1; i <= 20; i++) {
    const name = clean(m[`strIngredient${i}`]);
    if (name) ingredients.push({ name, measure: clean(m[`strMeasure${i}`]) ?? '' });
  }
  const id = String(m.idMeal);
  return {
    id,
    title: clean(m.strMeal) ?? 'Untitled',
    category: clean(m.strCategory),
    area: clean(m.strArea) ?? clean(m.strCountry),
    tags: (clean(m.strTags) ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    thumb: clean(m.strMealThumb),
    youtube: clean(m.strYoutube),
    steps: splitSteps(clean(m.strInstructions) ?? ''),
    ingredients,
    sourceUrl: `https://www.themealdb.com/meal/${encodeURIComponent(id)}`,
  };
}

export function createMealDb(baseUrl: string, apiKey: string, doFetch: typeof fetch = fetch): MealDb {
  const root = `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(apiKey)}`;
  const cache = new Map<string, { at: number; value: Promise<unknown> }>();
  let active = 0;
  const waiting: (() => void)[] = [];

  async function limited<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= 4) await new Promise<void>((r) => waiting.push(r));
    active++;
    try { return await fn(); } finally { active--; waiting.shift()?.(); }
  }

  async function getJson(path: string): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await doFetch(`${root}/${path}`, { signal: AbortSignal.timeout(10_000) });
        if (res.ok) return (await res.json()) as Record<string, unknown>;
        if (res.status < 500 && res.status !== 429) break;
      } catch { /* retry once */ }
    }
    throw new Error('TheMealDB is unavailable');
  }

  /** Cached, de-duplicated (concurrent callers share one request), and failures are not cached. */
  function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<T>;
    const value = limited(load);
    cache.set(key, { at: Date.now(), value });
    value.catch(() => cache.delete(key));
    return value;
  }

  return {
    ingredientNames: () => cached('names', DAY, async () => {
      const j = await getJson('list.php?i=list');
      return ((j.meals as { strIngredient?: string }[] | null) ?? []).map((m) => m.strIngredient ?? '').filter(Boolean);
    }),
    byIngredient: (name) => cached(`i:${name.toLowerCase()}`, DAY, async () => {
      const j = await getJson(`filter.php?i=${encodeURIComponent(name.trim().replace(/\s+/g, '_').toLowerCase())}`);
      const meals = Array.isArray(j.meals) ? (j.meals as { idMeal: string; strMeal: string }[]) : [];
      return meals.map((m) => ({ id: String(m.idMeal), name: m.strMeal }));
    }),
    detail: (id) => cached(`m:${id}`, DAY, async () => {
      const j = await getJson(`lookup.php?i=${encodeURIComponent(id)}`);
      const m = Array.isArray(j.meals) ? (j.meals[0] as Record<string, unknown> | undefined) : undefined;
      return m ? parseMeal(m) : null;
    }),
  };
}
