import rules from './rules/food-safety.json';
import type { Category, Life, Stage, Zone } from './types';

export const STAGE_ORDER: Stage[] = ['spoiled', 'rotting', 'expiring', 'aging', 'fresh'];

export const STAGE_META: Record<Stage, { label: string; weight: number }> = {
  fresh: { label: 'Fresh', weight: 1 },
  aging: { label: 'Aging', weight: 2 },
  expiring: { label: 'Expiring', weight: 3 },
  rotting: { label: 'Rotting', weight: 4 },
  spoiled: { label: 'Spoiled', weight: 0 },
};

/**
 * Storage sections, kept to the ones that change shelf life by a meaningful amount:
 * freezer (spoilage stops), fridge (slows several-fold), pantry (room temperature).
 * Crisper drawer and door shift shelf life by a day or so, less than estimate error.
 */
export const ZONE_ORDER: Zone[] = ['freezer', 'fridge', 'pantry'];

export const ZONES: Record<Zone, { label: string; temp: string }> = {
  freezer: { label: 'Freezer', temp: '−18 °C' },
  fridge: { label: 'Fridge', temp: '0–4 °C' },
  pantry: { label: 'Pantry', temp: 'room temperature' },
};

/** Every valid type, for validating stored and synced data. Pickers list them in this order. */
export const CATEGORIES: Category[] = [
  'vegetable', 'fruit', 'herbs', 'produce', 'dairy', 'meat', 'fish', 'eggs', 'leftovers',
  'bakery', 'dry', 'frozen', 'condiment', 'drink', 'other',
];

/** What the user sees when picking an item's type. `produce` predates vegetable/fruit/herbs. */
export const CATEGORY_LABEL: Record<Category, string> = {
  vegetable: 'Vegetable', fruit: 'Fruit', herbs: 'Herbs', produce: 'Mixed produce',
  dairy: 'Dairy', meat: 'Meat', fish: 'Fish', eggs: 'Eggs', leftovers: 'Leftovers',
  bakery: 'Bakery', dry: 'Dry goods', frozen: 'Frozen', condiment: 'Condiment', drink: 'Drink', other: 'Other',
};

export type { Life };

/**
 * Safety floor shared with the server (apps/api/src/products.ts): these spoil dangerously, so they are
 * never shown as pantry-safe and skip "rotting" straight to "spoiled". Not a shelf-life source.
 */
export const HIGH_RISK_CATEGORIES = new Set<Category>(rules.highRisk as Category[]);

/**
 * Last-resort, deliberately short estimates used ONLY when Gemini can't be reached (offline, quota spent,
 * AI turned off). Product-specific shelf life always comes from Gemini (POST /v1/products/info).
 * Dates from here are labelled "rough estimate" and, like all estimates, must be confirmed by the user.
 */
export const CATEGORY_FALLBACK = rules.categoryFallback as Record<Category, { home: Zone; life: Life }>;
