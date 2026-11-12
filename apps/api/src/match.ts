/** Words that describe preparation or size, not the ingredient itself. */
const DESCRIPTORS = new Set([
  'fresh', 'chopped', 'minced', 'sliced', 'diced', 'grated', 'crushed', 'large', 'small', 'medium',
  'whole', 'boneless', 'skinless', 'finely', 'roughly', 'dried', 'frozen', 'cooked', 'raw', 'organic',
  'ripe', 'baby', 'extra',
]);

/** Naive English singular. Good enough for ingredient nouns; covered by tests. */
export function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ss') || word.endsWith('us')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Order-independent token set for an ingredient name, e.g. "Chicken Breasts" -> {breast, chicken}. */
export function ingredientTokens(name: string): string[] {
  const tokens = name
    .normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .filter(Boolean).map(singular).filter((t) => !DESCRIPTORS.has(t));
  return [...new Set(tokens)].sort();
}

/**
 * True when two names are the same ingredient: same words, ignoring order, plurals and descriptors.
 * Deliberately strict: "butter" is not "peanut butter", and a miss only means "you need to buy it".
 */
export function sameIngredient(a: string, b: string): boolean {
  const ta = ingredientTokens(a);
  const tb = ingredientTokens(b);
  return ta.length > 0 && ta.length === tb.length && ta.every((t, i) => t === tb[i]);
}

/** Salt, pepper, water and cooking oil are assumed to be in every kitchen. */
const STAPLES = [
  'salt', 'sea salt', 'pepper', 'black pepper', 'white pepper', 'water', 'ice', 'oil',
  'olive oil', 'vegetable oil', 'sunflower oil', 'cooking oil', 'canola oil',
];
export const isStaple = (name: string) => STAPLES.some((s) => sameIngredient(s, name));
