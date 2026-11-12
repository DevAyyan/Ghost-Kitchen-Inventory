/**
 * Diet filters shown in the app. Which ingredients break a diet is decided by the server from Gemini's
 * ingredient tags (apps/api/src/schemas.ts DIET_EXCLUDES); if an ingredient can't be checked, the
 * recipe is hidden rather than guessed.
 */
export type Diet =
  | 'vegetarian' | 'vegan' | 'pescatarian' | 'halal'
  | 'gluten-free' | 'dairy-free' | 'egg-free' | 'nut-free' | 'shellfish-free' | 'low-carb';

export const DIETS: Record<Diet, { label: string; note?: string }> = {
  vegetarian: { label: 'Vegetarian' },
  vegan: { label: 'Vegan' },
  pescatarian: { label: 'Pescatarian' },
  halal: { label: 'Halal', note: 'Use halal-certified meat.' },
  'gluten-free': { label: 'Gluten-free', note: 'Check labels for hidden gluten.' },
  'dairy-free': { label: 'Dairy-free' },
  'egg-free': { label: 'Egg-free' },
  'nut-free': { label: 'Nut-free', note: 'Check labels for "may contain nuts". Not suitable for severe allergies.' },
  'shellfish-free': { label: 'Shellfish-free' },
  'low-carb': { label: 'Low-carb' },
};

export const DIET_ORDER: Diet[] = [
  'vegetarian', 'vegan', 'pescatarian', 'halal', 'gluten-free',
  'dairy-free', 'egg-free', 'nut-free', 'shellfish-free', 'low-carb',
];

export const dietNotes = (diets: Diet[]) => diets.flatMap((d) => (DIETS[d].note ? [DIETS[d].note!] : []));
