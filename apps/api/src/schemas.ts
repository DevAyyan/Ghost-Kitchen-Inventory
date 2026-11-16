import { z } from 'zod';

/** `produce` (mixed fruit and veg) predates vegetable, fruit and herbs; kept for salad kits and older data. */
export const CATEGORIES = [
  'vegetable', 'fruit', 'herbs', 'produce', 'dairy', 'meat', 'fish', 'eggs', 'leftovers',
  'bakery', 'dry', 'frozen', 'condiment', 'drink', 'other',
] as const;
export const Category = z.enum(CATEGORIES);
/** Prompt line steering the model to the specific produce types (the app picks an icon from them). */
export const CATEGORY_RULE = '- For fresh produce, category is vegetable, fruit or herbs. Use produce only for mixed packs such as salad kits or stir-fry mixes.';
export type Category = z.infer<typeof Category>;

export const Zone = z.enum(['freezer', 'fridge', 'pantry']);
export type Zone = z.infer<typeof Zone>;

/** How a bought amount is measured: counted pieces, or a weight / volume. */
export const Unit = z.enum(['pcs', 'kg', 'g', 'l', 'ml']);
export type Unit = z.infer<typeof Unit>;

/** What a food contains, for diet filtering. */
export const TAGS = ['meat', 'pork', 'fish', 'shellfish', 'dairy', 'egg', 'gluten', 'nuts', 'alcohol', 'highCarb'] as const;
export const Tag = z.enum(TAGS);
export type Tag = z.infer<typeof Tag>;

const Days = z.number().int().min(0).max(3650).nullable();

/** One product's storage facts, as answered by Gemini and sanitised by us (products.ts). */
export const ProductInfo = z.object({
  name: z.string().min(1).max(80).describe('Canonical product name, singular, e.g. "Chicken breast"'),
  category: Category,
  homeZone: Zone.describe('Where this is normally kept after buying'),
  shelfLifeDays: z.object({
    pantry: Days.describe('Days at room temperature; null if it should not be kept there'),
    fridge: Days.describe('Days in the fridge (0-4 C); null if unsuitable'),
    freezer: Days.describe('Days of good quality in the freezer; null if it does not freeze'),
  }),
  highRisk: z.boolean().describe('True if spoilage is a food-safety risk: raw meat or fish, dairy, eggs, cooked leftovers'),
  multiUse: z.boolean().describe('True if a typical pack lasts several meals (eggs, milk, rice, a block of cheese)'),
  tags: z.array(Tag).describe('Diet-relevant contents. Only tags that apply.'),
  tip: z.string().max(140).describe('One short storage tip, or empty string'),
});
export type ProductInfo = z.infer<typeof ProductInfo>;

export const DIETS = [
  'vegetarian', 'vegan', 'pescatarian', 'halal', 'gluten-free',
  'dairy-free', 'egg-free', 'nut-free', 'shellfish-free', 'low-carb',
] as const;
export const Diet = z.enum(DIETS);
export type Diet = z.infer<typeof Diet>;

/** Each diet rules out the union of its tags. */
export const DIET_EXCLUDES: Record<Diet, Tag[]> = {
  vegetarian: ['meat', 'pork', 'fish', 'shellfish'],
  vegan: ['meat', 'pork', 'fish', 'shellfish', 'dairy', 'egg'],
  pescatarian: ['meat', 'pork'],
  halal: ['pork', 'alcohol'],
  'gluten-free': ['gluten'],
  'dairy-free': ['dairy'],
  'egg-free': ['egg'],
  'nut-free': ['nuts'],
  'shellfish-free': ['shellfish'],
  'low-carb': ['highCarb'],
};

/** Gemini's reading of an OCR'd receipt. */
export const ReceiptExtraction = z.object({
  store: z.string().max(100).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe('Purchase date, YYYY-MM-DD'),
  currency: z.object({
    code: z.string().regex(/^[A-Z]{3}$/).nullable().describe('ISO 4217 code, or null if you cannot tell'),
    symbol: z.string().max(6).nullable().describe('Symbol printed on the receipt, e.g. "$", "Rs"'),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string().max(80)).max(5).describe('Clues used: symbols, address, tax names, phone prefix'),
  }),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  items: z.array(z.object({
    sourceLine: z.number().int().min(0).describe('Index of the OCR line this item came from'),
    raw: z.string().max(120).describe('The receipt text for this item, as printed'),
    name: z.string().min(1).max(80).describe('Plain product name, e.g. "Chicken breast"'),
    quantity: z.number().min(0).max(10000).describe('How much was bought, in `unit`'),
    unit: Unit.describe('pcs for counted items; kg, g, l or ml for weights and volumes'),
    price: z.number().min(0).describe('Line total in the receipt currency, as a plain number'),
    category: Category,
    isFood: z.boolean().describe('False for bags, deposits, discounts, household goods'),
    certainty: z.number().min(0).max(1),
  })).max(150),
});
export type ReceiptExtraction = z.infer<typeof ReceiptExtraction>;

/** Keywords Gemini's generateContent rejects with HTTP 400 (checked against the live API). Zod still enforces them. */
const UNSUPPORTED = new Set(['$schema', 'maxItems', 'minItems']);

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).filter(([k]) => !UNSUPPORTED.has(k)).map(([k, v]) => [k, stripUnsupported(v)]));
  }
  return node;
}

/** JSON Schema for Gemini, generated from the Zod schema so the two can't drift. */
export function geminiSchema(schema: z.ZodType): Record<string, unknown> {
  return stripUnsupported(z.toJSONSchema(schema, { target: 'draft-7' })) as Record<string, unknown>;
}
