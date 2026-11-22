/**
 * Demo mode: the app answers its own server calls with recorded data, so a demo works with no server,
 * no internet and no AI quota. Nothing leaves the device. Every screen that shows these answers says so.
 */
import type { RemoteRecipe, ServerStatus, SuggestResult, TonightIdea } from '@/lib/api';
import { today } from '../domain/dates';
import type { Diet } from '../domain/diets';
import { productKey, type ProductInfo } from '../domain/product-info';
import { DEMO_BARCODE, DEMO_ITEM_PHOTO, DEMO_RECEIPT } from './fixtures';
import { DEMO_PRODUCTS, DEMO_RECIPE_FITS } from './products';
import { coversIngredient, isStaple } from './match';
import recorded from './recipes.json';
import rates from './rates.json';

export const DEMO_NOTE = 'Demo mode: these are recorded sample answers, not a live reading.';

interface RecordedMeal {
  id: string; title: string; category: string | null; area: string | null; tags: string[]; thumb: string | null;
  youtube: string | null; steps: string[]; ingredients: { name: string; measure: string }[]; sourceUrl: string;
}
const MEALS = recorded as RecordedMeal[];
const PRODUCTS = new Map(DEMO_PRODUCTS.map((p) => [productKey(p.name), p]));

/** Thrown for features demo mode doesn't fake (accounts, households). Same shape as a server error. */
export class DemoUnavailable extends Error {
  code = 'demo_unavailable';
  status = 0;
}

type SuggestBody = { items: { id: string; name: string; urgency: number }[]; diets: Diet[]; limit: number; page: number };
type TonightBody = { items: { name: string; daysLeft: number; highRisk: boolean }[]; diets: Diet[] };

const fitsDiets = (mealId: string, diets: Diet[]) => diets.every((d) => (DEMO_RECIPE_FITS[mealId] ?? []).includes(d));

/**
 * Ranks the recorded meals for the given fridge the way the server does in spirit: rescue urgent food,
 * avoid shopping. Items arrive already filtered by the client (no spoiled or rotting high-risk food).
 */
export function demoSuggest(body: SuggestBody): SuggestResult {
  const ranked: RemoteRecipe[] = [];
  for (const m of MEALS) {
    if (!fitsDiets(m.id, body.diets)) continue;
    const used = new Set<string>();
    const ingredients = m.ingredients.map((ing) => {
      if (isStaple(ing.name)) return { ...ing, staple: true, inStock: true, itemId: null };
      const item = body.items.find((i) => coversIngredient(i.name, ing.name));
      if (item) used.add(item.id);
      return { ...ing, staple: false, inStock: !!item, itemId: item?.id ?? null };
    });
    const missing = ingredients.filter((i) => !i.staple && !i.inStock).map((i) => i.name);
    if (used.size === 0 || missing.length > 5) continue;
    const rescues = body.items.filter((i) => used.has(i.id) && i.urgency >= 2);
    const score = rescues.reduce((s, i) => s + i.urgency ** 2, 0) + used.size - missing.length * 4;
    ranked.push({ ...m, ingredients, rescuesItemIds: rescues.map((i) => i.id), missing, score, uses: {} });
  }
  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const size = Math.max(1, body.limit);
  const pages = Math.max(1, Math.ceil(ranked.length / size));
  const number = Math.min(Math.max(1, body.page), pages);
  return {
    recipes: ranked.slice((number - 1) * size, number * size),
    warnings: [`${DEMO_NOTE} Recipes are from TheMealDB, recorded for offline use.`],
    page: { number, size, total: ranked.length, pages },
    meta: { seeds: [], unmatchedSeeds: [], candidates: MEALS.length },
  };
}

/** Tonight's idea: the best recorded recipe for the most urgent food, or the plain nudge when none fits. */
export function demoTonight(body: TonightBody): TonightIdea {
  const usable = body.items.filter((i) => !(i.highRisk && i.daysLeft < 0)).sort((a, b) => a.daysLeft - b.daysLeft);
  const best = demoSuggest({ items: usable.map((i, n) => ({ id: String(n), name: i.name, urgency: Math.max(1, 4 - Math.max(0, i.daysLeft)) })), diets: body.diets, limit: 1, page: 1 }).recipes[0];
  if (best) {
    const uses = usable.filter((_, n) => best.ingredients.some((g) => g.itemId === String(n))).map((i) => i.name);
    return { title: best.title.slice(0, 60), pitch: `A recorded TheMealDB recipe that uses ${uses.join(' and ')}. Demo mode.`.slice(0, 160), uses, source: 'template' };
  }
  const names = usable.slice(0, 3).map((i) => i.name);
  return { title: `Cook with ${names.join(', ') || 'what is in your fridge'}`, pitch: 'Use these first. A stir-fry, soup, omelette or tray bake covers most of them.', uses: names, source: 'template' };
}

function demoRates(base: string) {
  const r = rates.rates as Record<string, number>;
  const per = r[base];
  if (!per) throw new DemoUnavailable(`No recorded exchange rate for ${base}.`);
  return { base, date: rates.date, stale: false, rates: Object.fromEntries(Object.entries(r).map(([c, v]) => [c, v / per])) };
}

const STATUS: ServerStatus = {
  ok: true, db: true, ocr: true,
  ai: { enabled: true, model: 'demo (recorded answers)', usedToday: 0, limitPerDay: 0 },
  recipes: { provider: 'themealdb (recorded)', keyType: 'test' },
  auth: { provider: 'none' },
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const parse = (init: RequestInit) => (typeof init.body === 'string' ? JSON.parse(init.body) : {}) as Record<string, unknown>;

/** Answers one API call. `path` includes the query string. */
export async function demoReply(path: string, init: RequestInit): Promise<unknown> {
  const [route, query = ''] = path.split('?');
  const body = parse(init);
  // A short pause so progress steps show as they would live; scans take longest.
  switch (route) {
    case '/v1/status': return STATUS;
    case '/v1/receipts/scan': {
      await wait(1800);
      const form = init.body as FormData | undefined;
      const useAi = String(form?.get?.('useAi') ?? 'true') !== 'false';
      const date = today();
      // AI off: names stay as printed and categories are guesses, as the rules reader does.
      if (!useAi) return { ...DEMO_RECEIPT, date, source: 'rules', currency: { ...DEMO_RECEIPT.currency, confidence: 0.6 }, lines: DEMO_RECEIPT.lines.map((l) => ({ ...l, name: l.raw, confidence: Math.min(l.confidence, 0.6) })) };
      return { ...DEMO_RECEIPT, date };
    }
    case '/v1/items/scan': await wait(1200); return DEMO_ITEM_PHOTO;
    case '/v1/products/info': {
      await wait(500);
      const names = Array.isArray(body.names) ? (body.names as string[]) : [];
      if (body.useAi === false) return { products: Object.fromEntries(names.map((n) => [n, null])), ai: 'skipped' };
      const products: Record<string, ProductInfo | null> = {};
      for (const n of names) products[n] = PRODUCTS.get(productKey(n)) ?? null;
      return { products, ai: 'ok' };
    }
    case '/v1/recipes/suggest': await wait(900); return demoSuggest(body as unknown as SuggestBody);
    case '/v1/tonight': await wait(600); return demoTonight(body as unknown as TonightBody);
    // The app's own parser already ran; demo mode has no AI to fall back on.
    case '/v1/voice/parse': return { actions: [], source: 'none' };
    case '/v1/rates': return demoRates(new URLSearchParams(query).get('base') ?? 'EUR');
    default:
      if (route?.startsWith('/v1/barcodes/')) { await wait(500); return DEMO_BARCODE(decodeURIComponent(route.slice('/v1/barcodes/'.length))); }
      throw new DemoUnavailable("This isn't available in demo mode. Turn demo mode off in Settings to use your server.");
  }
}
