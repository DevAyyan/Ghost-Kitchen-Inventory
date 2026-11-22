/**
 * Ingredient matching for demo mode, copied from apps/api/src/match.ts (the client can't import server
 * code). A test in apps/api/test/demo.test.ts fails if the two ever answer differently.
 */
const DESCRIPTORS = new Set([
  'fresh', 'chopped', 'minced', 'sliced', 'diced', 'grated', 'crushed', 'large', 'small', 'medium',
  'whole', 'boneless', 'skinless', 'finely', 'roughly', 'dried', 'frozen', 'cooked', 'raw', 'organic',
  'ripe', 'baby', 'extra',
]);

const QUALIFIERS = new Set([
  'breast', 'thigh', 'drumstick', 'wing', 'leg', 'fillet', 'loin', 'steak', 'mince', 'ground', 'chop', 'rib', 'shoulder',
  'tenderloin', 'cutlet', 'strip', 'piece', 'chunk', 'floret', 'clove', 'head', 'bulb', 'sprig', 'leaf', 'stalk', 'bunch',
  'cherry', 'plum', 'roma', 'vine', 'red', 'green', 'yellow', 'white', 'brown', 'new',
  'free', 'range', 'farm', 'wild', 'grass', 'fed', 'bio', 'british', 'local', 'pack', 'bag', 'loose', 'value', 'premium',
  'lean', 'semi', 'skimmed', 'full', 'fat', 'low', 'unsalted', 'salted', 'plain', 'natural', 'mild', 'mature',
]);

const STAPLES = [
  'salt', 'sea salt', 'pepper', 'black pepper', 'white pepper', 'water', 'ice', 'oil',
  'olive oil', 'vegetable oil', 'sunflower oil', 'cooking oil', 'canola oil',
];

function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ss') || word.endsWith('us')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function ingredientTokens(name: string): string[] {
  const tokens = name
    .normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .filter(Boolean).map(singular).filter((t) => !DESCRIPTORS.has(t));
  return [...new Set(tokens)].sort();
}

function sameIngredient(a: string, b: string): boolean {
  const ta = ingredientTokens(a);
  const tb = ingredientTokens(b);
  return ta.length > 0 && ta.length === tb.length && ta.every((t, i) => t === tb[i]);
}

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

export const isStaple = (name: string) => STAPLES.some((s) => sameIngredient(s, name));
