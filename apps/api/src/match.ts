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
 * Strict on purpose; used for staples. For fridge items against recipes, use `coversIngredient`.
 */
export function sameIngredient(a: string, b: string): boolean {
  const ta = ingredientTokens(a);
  const tb = ingredientTokens(b);
  return ta.length > 0 && ta.length === tb.length && ta.every((t, i) => t === tb[i]);
}

/**
 * Words that narrow an ingredient down without making it a different food: a cut, a variety, how it was
 * raised or packed. "Chicken breast" is still chicken; "peanut butter" is not butter, because "peanut"
 * isn't on this list. Kept small and explicit: a missed match only means "you need to buy it", a wrong
 * one would claim a rescue that isn't real.
 */
const QUALIFIERS = new Set([
  // cuts and parts
  'breast', 'thigh', 'drumstick', 'wing', 'leg', 'fillet', 'loin', 'steak', 'mince', 'ground', 'chop', 'rib', 'shoulder',
  'tenderloin', 'cutlet', 'strip', 'piece', 'chunk', 'floret', 'clove', 'head', 'bulb', 'sprig', 'leaf', 'stalk', 'bunch',
  // varieties and colours ("sweet potato", "spring onion" and "beef tomato" are left out: different foods)
  'cherry', 'plum', 'roma', 'vine', 'red', 'green', 'yellow', 'white', 'brown', 'new',
  // how it was raised, grown or packed
  'free', 'range', 'farm', 'wild', 'grass', 'fed', 'bio', 'british', 'local', 'pack', 'bag', 'loose', 'value', 'premium',
  'lean', 'semi', 'skimmed', 'full', 'fat', 'low', 'unsalted', 'salted', 'plain', 'natural', 'mild', 'mature',
]);

/**
 * True when a fridge item can stand in for a recipe ingredient: the same food, or one of the two adds only
 * qualifiers. "Chicken breast" covers "Chicken", "Cherry tomatoes" covers "Tomatoes", "Free range eggs"
 * covers "Eggs"; "Peanut butter" never covers "Butter" and "Coconut milk" never covers "Milk".
 */
export function coversIngredient(item: string, ingredient: string): boolean {
  if (sameIngredient(item, ingredient)) return true;
  const a = ingredientTokens(item);
  const b = ingredientTokens(ingredient);
  if (a.length === 0 || b.length === 0) return false;
  const [big, small] = a.length >= b.length ? [a, b] : [b, a];
  if (!small.every((t) => big.includes(t))) return false;
  const extra = big.filter((t) => !small.includes(t));
  return extra.length > 0 && extra.every((t) => QUALIFIERS.has(t));
}

/** Salt, pepper, water and cooking oil are assumed to be in every kitchen. */
const STAPLES = [
  'salt', 'sea salt', 'pepper', 'black pepper', 'white pepper', 'water', 'ice', 'oil',
  'olive oil', 'vegetable oil', 'sunflower oil', 'cooking oil', 'canola oil',
];
export const isStaple = (name: string) => STAPLES.some((s) => sameIngredient(s, name));

export type Unit = 'pcs' | 'kg' | 'g' | 'l' | 'ml';

/** Grams or millilitres per unit, for the units TheMealDB measures are written in. */
const MASS: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, kilo: 1000, oz: 28.35, ounce: 28.35, lb: 453.6, lbs: 453.6, pound: 453.6 };
const VOLUME: Record<string, number> = {
  ml: 1, millilitre: 1, milliliter: 1, l: 1000, litre: 1000, liter: 1000, cl: 10, dl: 100,
  tsp: 5, teaspoon: 5, tbsp: 15, tbs: 15, tablespoon: 15, cup: 240, pint: 568,
};
/** Words that name a count of whole things, like "2 large" or "3 cloves". */
const COUNT_WORDS = new Set(['', 'large', 'medium', 'small', 'whole', 'clove', 'cloves', 'piece', 'pieces', 'head', 'bunch', 'can', 'tin']);

/** "1/2", "1 1/2", "1½", "0.5", "2-3" (uses the larger, so a rescue isn't overstated as left over). */
function readNumber(s: string): { value: number; rest: string } | null {
  const t = s.replace('½', ' 1/2').replace('¼', ' 1/4').replace('¾', ' 3/4').trim();
  const m = /^(\d+(?:[.,]\d+)?)(?:\s+(\d+)\/(\d+)|\/(\d+))?(?:\s*-\s*(\d+(?:[.,]\d+)?))?/.exec(t);
  if (!m) return null;
  let v = Number(m[1]!.replace(',', '.'));
  if (m[2] && m[3]) v += Number(m[2]) / Number(m[3]);
  if (m[4]) v /= Number(m[4]);
  if (m[5]) v = Math.max(v, Number(m[5].replace(',', '.')));
  return Number.isFinite(v) && v > 0 ? { value: v, rest: t.slice(m[0].length).trim().toLowerCase() } : null;
}

/**
 * A recipe measure ("300g", "2 cups", "3 large", "1/2 lb") as an amount in the fridge item's unit, or null
 * when it can't be read reliably ("to taste", "a handful", or mass against a volume).
 */
export function measureIn(measure: string, unit: Unit): number | null {
  const n = readNumber(measure);
  if (!n) return null;
  const word = (/^[a-z]+/.exec(n.rest)?.[0] ?? '').replace(/s$/, '');
  const plural = (/^[a-z]+/.exec(n.rest)?.[0] ?? '');
  if (unit === 'pcs') return COUNT_WORDS.has(plural) || COUNT_WORDS.has(word) ? n.value : null;
  const mass = MASS[plural] ?? MASS[word];
  const vol = VOLUME[plural] ?? VOLUME[word];
  if (unit === 'g' || unit === 'kg') return mass ? (n.value * mass) / (unit === 'kg' ? 1000 : 1) : null;
  return vol ? (n.value * vol) / (unit === 'l' ? 1000 : 1) : null;
}
