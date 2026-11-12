import { describe, expect, it } from 'vitest';
import { isStaple, sameIngredient, singular } from '../src/match.js';
import { splitSteps } from '../src/mealdb.js';
import { productKey, sanitizeProduct } from '../src/products.js';
import { plausibleDate } from '../src/receipts.js';
import { detectCurrency, parseWithRules, readAmount } from '../src/receipt-rules.js';
import { geminiSchema, ReceiptExtraction, type ProductInfo } from '../src/schemas.js';

describe('ingredient matching', () => {
  it('singularises common ingredient nouns', () => {
    expect(['tomatoes', 'potatoes', 'berries', 'peaches', 'eggs', 'cheese', 'hummus', 'grass'].map(singular))
      .toEqual(['tomato', 'potato', 'berry', 'peach', 'egg', 'cheese', 'hummus', 'grass']);
  });
  it('treats plurals, case and word order as the same ingredient', () => {
    expect(sameIngredient('Chicken Breasts', 'chicken breast')).toBe(true);
    expect(sameIngredient('Breast, Chicken', 'Chicken breast')).toBe(true);
    expect(sameIngredient('Fresh Spinach', 'Spinach')).toBe(true);
  });
  it('never confuses different foods that share a word', () => {
    expect(sameIngredient('Butter', 'Peanut Butter')).toBe(false);
    expect(sameIngredient('Chicken', 'Chicken Stock')).toBe(false);
    expect(sameIngredient('Milk', 'Coconut Milk')).toBe(false);
  });
  it('knows pantry staples', () => {
    expect(['Salt', 'Black Pepper', 'olive oil', 'Water'].every(isStaple)).toBe(true);
    expect(isStaple('Peanut Oil Spray')).toBe(false);
  });
});

describe('productKey', () => {
  it('ignores case, accents and punctuation', () => {
    expect(productKey('  Crème  Fraîche! ')).toBe('creme fraiche');
  });
});

const base: ProductInfo = {
  name: 'Thing', category: 'produce', homeZone: 'fridge',
  shelfLifeDays: { pantry: 3, fridge: 7, freezer: 200 },
  highRisk: false, multiUse: false, tags: [], tip: '',
};

describe('sanitizeProduct safety floors', () => {
  it('forces high risk for meat, fish, eggs, dairy and leftovers, whatever the model says', () => {
    for (const category of ['meat', 'fish', 'eggs', 'dairy', 'leftovers'] as const) {
      expect(sanitizeProduct({ ...base, category, highRisk: false })?.highRisk).toBe(true);
    }
  });
  it('never allows high-risk food at room temperature', () => {
    const out = sanitizeProduct({ ...base, category: 'meat', homeZone: 'pantry', shelfLifeDays: { pantry: 5, fridge: 2, freezer: 200 } });
    expect(out?.shelfLifeDays.pantry).toBeNull();
    expect(out?.homeZone).toBe('fridge');
  });
  it('moves the home zone to somewhere usable', () => {
    const out = sanitizeProduct({ ...base, homeZone: 'pantry', shelfLifeDays: { pantry: null, fridge: null, freezer: 90 } });
    expect(out?.homeZone).toBe('freezer');
  });
  it('rejects an answer with no usable storage at all', () => {
    expect(sanitizeProduct({ ...base, shelfLifeDays: { pantry: null, fridge: null, freezer: null } })).toBeNull();
  });
  it('removes duplicate tags', () => {
    expect(sanitizeProduct({ ...base, tags: ['dairy', 'dairy'] })?.tags).toEqual(['dairy']);
  });
});

describe('rule-based receipt parser', () => {
  const lines = ['FRESHMART', '123 Main St Austin', '03/11/2026', 'CHKN BRST 7.99', 'BABY SPINACH 3.49', 'PAPER BAG 0.10', 'SUBTOTAL 11.58', 'TAX 0.95', 'TOTAL 12.53', '$12.53 VISA']
    .map((text) => ({ text, confidence: 0.9 }));
  const r = parseWithRules(lines);
  it('finds the items and skips totals, tax and card lines', () => {
    expect(r.items.map((i) => [i.name, i.price])).toEqual([['CHKN BRST', 7.99], ['BABY SPINACH', 3.49], ['PAPER BAG', 0.1]]);
  });
  it('reads subtotal, tax and total', () => {
    expect([r.subtotal, r.tax, r.total]).toEqual([11.58, 0.95, 12.53]);
  });
  it('reads the store and a day-first date', () => {
    expect(r.store).toBe('FRESHMART');
    expect(r.date).toBe('2026-11-03');
  });
  it('flags a lone dollar sign as ambiguous instead of guessing USD', () => {
    expect(r.currency.code).toBeNull();
    expect(r.currency.symbol).toBe('$');
    expect(r.currency.confidence).toBeLessThan(0.8);
  });
  it('trusts an unambiguous symbol or a printed code', () => {
    expect(detectCurrency('Milch 1,29 €')).toMatchObject({ code: 'EUR' });
    expect(detectCurrency('Total PKR 2,705')).toMatchObject({ code: 'PKR', confidence: 0.9 });
  });
  it('does not mistake product abbreviations for currency codes', () => {
    expect(detectCurrency('GRK YOG PLN 32z 4.29').code).toBeNull();
    expect(detectCurrency('Total 32.35 USD').code).toBe('USD');
  });
  it('reads a whole-rupee receipt even when only "Rs" is printed', () => {
    const pk = parseWithRules(['IMTIAZ', 'DATE 03/11/2026', 'DOODH NESTLE 1LTR 280', 'ANDAY DESI 12PC 420', 'TOTAL Rs. 700', 'CASH 1000'].map((text) => ({ text, confidence: 0.9 })));
    expect(pk.items.map((i) => [i.name, i.price])).toEqual([['DOODH NESTLE 1LTR', 280], ['ANDAY DESI 12PC', 420]]);
    expect(pk.total).toBe(700);
    expect(pk.currency.symbol).toBe('Rs');
  });
  it('reads comma decimals and whole-rupee prices', () => {
    expect(parseWithRules([{ text: 'Butter 2,19', confidence: 1 }]).items[0]?.price).toBe(2.19);
    const pk = parseWithRules(['Store', 'DOODH NESTLE 280', 'PKR total 280'].map((text) => ({ text, confidence: 1 })));
    expect(pk.items[0]).toMatchObject({ name: 'DOODH NESTLE', price: 280 });
  });
});

describe('geminiSchema', () => {
  it('drops keywords Gemini rejects, keeps the rest', () => {
    const s = JSON.stringify(geminiSchema(ReceiptExtraction));
    expect(s).not.toMatch(/maxItems|minItems|\$schema/);
    expect(s).toContain('"enum"');
    expect(s).toContain('sourceLine');
  });
});

describe('splitSteps', () => {
  it('splits on lines and drops bare step numbers', () => {
    expect(splitSteps('STEP 1\r\nChop the onion.\r\n2\r\nFry it.')).toEqual(['Chop the onion.', 'Fry it.']);
  });
  it('falls back to sentences for one long paragraph', () => {
    const text = 'Chop the onion finely and set aside. '.repeat(3) + 'Fry it until golden. '.repeat(6);
    expect(splitSteps(text).length).toBeGreaterThan(3);
  });
});

describe('plausibleDate', () => {
  it('keeps past dates, swaps misread day/month, drops impossible ones', () => {
    expect(plausibleDate('2026-11-03', '2026-11-12')).toBe('2026-11-03');
    expect(plausibleDate('2026-12-03', '2026-11-12')).toBe('2026-03-12');
    expect(plausibleDate('2027-01-01', '2026-11-12')).toBeNull();
    expect(plausibleDate(null, '2026-11-12')).toBeNull();
  });
});

describe('readAmount', () => {
  it('reads weights, volumes, counts and multiples from receipt text', () => {
    expect(readAmount('TAMATAR 1KG')).toEqual({ quantity: 1, unit: 'kg' });
    expect(readAmount('ADRAK 250G')).toEqual({ quantity: 250, unit: 'g' });
    expect(readAmount('DOODH NESTLE 1LTR')).toEqual({ quantity: 1, unit: 'l' });
    expect(readAmount('Cream 200 ml')).toEqual({ quantity: 200, unit: 'ml' });
    expect(readAmount('ANDAY DESI 12PC')).toEqual({ quantity: 12, unit: 'pcs' });
    expect(readAmount('EGGS 1 DOZEN')).toEqual({ quantity: 12, unit: 'pcs' });
    expect(readAmount('HASS AVOCADO 2@1.25')).toEqual({ quantity: 2, unit: 'pcs' });
    expect(readAmount('Paprika rot 1,5kg')).toEqual({ quantity: 1.5, unit: 'kg' });
  });
  it('defaults to one piece and is not fooled by codes like 32Z or 5OZ', () => {
    expect(readAmount('BABY SPINACH')).toEqual({ quantity: 1, unit: 'pcs' });
    expect(readAmount('GRK YOG PLN 32Z')).toEqual({ quantity: 1, unit: 'pcs' });
  });
  it('is applied by the rule-based parser', () => {
    const r = parseWithRules(['SHOP', 'TAMATAR 1KG 220', 'ANDAY DESI 12PC 420', 'TOTAL Rs. 640'].map((text) => ({ text, confidence: 0.9 })));
    expect(r.items.map((i) => [i.name, i.quantity, i.unit])).toEqual([['TAMATAR 1KG', 1, 'kg'], ['ANDAY DESI 12PC', 12, 'pcs']]);
  });
});
