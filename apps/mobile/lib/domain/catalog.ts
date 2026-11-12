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

export const CATEGORIES: Category[] = [
  'produce', 'dairy', 'meat', 'fish', 'eggs', 'leftovers',
  'bakery', 'dry', 'frozen', 'condiment', 'drink', 'other',
];

export type { Life };

/**
 * Safety floor shared with the server (apps/api/src/products.ts): these spoil dangerously, so they are
 * never shown as pantry-safe and skip "rotting" straight to "spoiled". Not a shelf-life source.
 */
export const HIGH_RISK_CATEGORIES = new Set<Category>(['dairy', 'meat', 'fish', 'eggs', 'leftovers']);

/**
 * Last-resort, deliberately short estimates used ONLY when Gemini can't be reached (offline, quota spent,
 * AI turned off). Product-specific shelf life always comes from Gemini (POST /v1/products/info).
 * Dates from here are labelled "rough estimate" and, like all estimates, must be confirmed by the user.
 */
export const CATEGORY_FALLBACK: Record<Category, { home: Zone; life: Life }> = {
  produce: { home: 'fridge', life: { pantry: 2, fridge: 5, freezer: 180 } },
  dairy: { home: 'fridge', life: { pantry: null, fridge: 5, freezer: 60 } },
  meat: { home: 'fridge', life: { pantry: null, fridge: 1, freezer: 90 } },
  fish: { home: 'fridge', life: { pantry: null, fridge: 1, freezer: 60 } },
  eggs: { home: 'fridge', life: { pantry: null, fridge: 14, freezer: null } },
  leftovers: { home: 'fridge', life: { pantry: null, fridge: 2, freezer: 60 } },
  bakery: { home: 'pantry', life: { pantry: 3, fridge: 5, freezer: 60 } },
  dry: { home: 'pantry', life: { pantry: 180, fridge: 180, freezer: 180 } },
  frozen: { home: 'freezer', life: { pantry: null, fridge: 1, freezer: 90 } },
  condiment: { home: 'fridge', life: { pantry: 14, fridge: 30, freezer: null } },
  drink: { home: 'fridge', life: { pantry: 1, fridge: 5, freezer: 90 } },
  other: { home: 'pantry', life: { pantry: 7, fridge: 7, freezer: 60 } },
};
