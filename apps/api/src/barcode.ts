import { z } from 'zod';
import { Category } from './schemas.js';

/** EAN-8, UPC-A (12), EAN-13 and GTIN-14: the codes printed on groceries. */
export const BarcodeCode = z.string().regex(/^\d{8,14}$/, 'A barcode is 8 to 14 digits.');

export const BarcodeProduct = z.object({
  code: z.string(),
  name: z.string().min(1).max(80),
  brand: z.string().max(80).nullable(),
  category: Category,
  qty: z.number().positive().nullable(),
  unit: z.enum(['pcs', 'kg', 'g', 'l', 'ml']).nullable(),
});
export type BarcodeProduct = z.infer<typeof BarcodeProduct>;

/** Open Food Facts' answer, only the fields we ask for. Everything is optional: entries are crowd-sourced. */
const OffResponse = z.object({
  status: z.number(),
  product: z
    .object({
      product_name: z.string().optional(),
      product_name_en: z.string().optional(),
      generic_name: z.string().optional(),
      brands: z.string().optional(),
      quantity: z.string().optional(),
      product_quantity: z.union([z.number(), z.string()]).optional(),
      product_quantity_unit: z.string().optional(),
      categories_tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export class BarcodeError extends Error {
  constructor(public code: 'not_found' | 'barcode_unavailable', message: string, public status: number) {
    super(message);
  }
}

/**
 * Open Food Facts category tag -> our category. First match wins, so the specific ones come first
 * (frozen peas are "frozen", not "vegetable"). Only a hint: the product lookup still sets shelf life and
 * the server's high-risk floor (sanitizeProduct) still applies on top.
 */
const CATEGORY_TAGS: [RegExp, Category][] = [
  [/^en:frozen/, 'frozen'],
  [/^en:(meats|poultry|beef|pork|chicken|sausages|hams)/, 'meat'],
  [/^en:(fishes|seafood|fish)/, 'fish'],
  [/^en:eggs$/, 'eggs'],
  [/^en:(dairies|dairy|milks|cheeses|yogurts|creams|butters)/, 'dairy'],
  [/^en:(herbs|fresh-herbs|aromatic-plants)/, 'herbs'],
  [/^en:(fresh-vegetables|vegetables|leaf-vegetables|root-vegetables)/, 'vegetable'],
  [/^en:(fresh-fruits|fruits|berries|citrus)/, 'fruit'],
  [/^en:(breads|bakery|viennoiseries|cakes|biscuits)/, 'bakery'],
  [/^en:(beverages|drinks|juices|waters|sodas)/, 'drink'],
  [/^en:(condiments|sauces|spreads|dressings|mustards|ketchup)/, 'condiment'],
  [/^en:(cereals|pastas|rices|legumes|flours|canned|snacks|dried|nuts|seeds|sugars)/, 'dry'],
];

export function categoryFromTags(tags: string[]): Category {
  for (const [re, cat] of CATEGORY_TAGS) if (tags.some((t) => re.test(t))) return cat;
  return 'other';
}

/** "500 g", "1,5 L", "33 cl" -> amount and unit. Anything else (e.g. "6 x 125 g") stays unknown. */
export function parseOffQuantity(q: string | undefined): { qty: number; unit: BarcodeProduct['unit'] } | null {
  const m = q?.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl)$/i);
  if (!m) return null;
  const n = Number(m[1]!.replace(',', '.'));
  if (!(n > 0)) return null;
  const u = m[2]!.toLowerCase();
  if (u === 'cl') return { qty: n * 10, unit: 'ml' };
  return { qty: n, unit: u as BarcodeProduct['unit'] };
}

const MAX_CACHE = 500;
const MISS_MS = 60 * 60 * 1000;
const USER_AGENT = 'GhostKitchen/1.0 (+https://github.com/DevAyyan/Ghost-Kitchen-Inventory)';

/** Product names from Open Food Facts (free, open data under ODbL), cached in memory. */
export function createBarcodes(baseUrl: string, doFetch: typeof fetch = fetch) {
  const root = baseUrl.replace(/\/$/, '');
  const hits = new Map<string, BarcodeProduct>();
  const misses = new Map<string, number>();

  return {
    async lookup(code: string): Promise<BarcodeProduct> {
      const cached = hits.get(code);
      if (cached) return cached;
      const missAt = misses.get(code);
      if (missAt && Date.now() - missAt < MISS_MS) throw notFound();

      let body: unknown;
      try {
        const url = `${root}/api/v2/product/${code}.json?fields=product_name,product_name_en,generic_name,brands,quantity,product_quantity,product_quantity_unit,categories_tags`;
        const res = await doFetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
        // OFF answers 404 with a JSON body for unknown codes.
        if (res.status === 404) body = { status: 0 };
        else if (!res.ok) throw new Error(`HTTP ${res.status}`);
        else body = await res.json();
      } catch {
        throw new BarcodeError('barcode_unavailable', "Couldn't look up barcodes right now. Try again, or add it by hand.", 502);
      }

      const parsed = OffResponse.safeParse(body);
      const p = parsed.success && parsed.data.status === 1 ? parsed.data.product : undefined;
      const name = (p?.product_name_en || p?.product_name || p?.generic_name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!p || !name) {
        if (misses.size >= MAX_CACHE) misses.clear();
        misses.set(code, Date.now());
        throw notFound();
      }
      const amount = parseOffQuantity(p.product_quantity !== undefined && p.product_quantity_unit ? `${p.product_quantity} ${p.product_quantity_unit}` : undefined)
        ?? parseOffQuantity(p.quantity);
      const product = BarcodeProduct.parse({
        code,
        name,
        brand: p.brands?.split(',')[0]?.trim().slice(0, 80) || null,
        category: categoryFromTags(p.categories_tags ?? []),
        qty: amount?.qty ?? null,
        unit: amount?.unit ?? null,
      });
      if (hits.size >= MAX_CACHE) hits.delete(hits.keys().next().value!);
      hits.set(code, product);
      return product;
    },
  };
}
export type Barcodes = ReturnType<typeof createBarcodes>;

const notFound = () => new BarcodeError('not_found', "We couldn't find that barcode. Add the item by hand instead.", 404);
