/**
 * Sample answers for demo mode. The receipt is docs/demo/sample-receipt.png (bundled as
 * assets/images/demo-receipt.png). Product facts and recipe diets are in ./products.ts.
 */
import type { BarcodeProduct, ItemPhotoResult, ScanResult } from '@/lib/api';

/** The sample receipt, read the way the server reads it with AI on. `date` is filled in with today. */
export const DEMO_RECEIPT: Omit<ScanResult, 'date'> = {
  store: 'Green Grocer Market',
  currency: { code: 'GBP', symbol: '£', confidence: 0.98, evidence: ['the £ symbol', '"TOTAL GBP"', 'a London address'] },
  subtotal: 26.29, tax: null, total: 26.29,
  source: 'gemini',
  ocr: { lineCount: 17, avgConfidence: 0.91 },
  warnings: [],
  lines: [
    { sourceLine: 4, raw: 'WHOLE MILK 2L', name: 'Whole milk', quantity: 2, unit: 'l', price: 2.15, category: 'dairy', isFood: true, confidence: 0.97 },
    { sourceLine: 5, raw: 'FREE RANGE EGGS 12', name: 'Eggs', quantity: 12, unit: 'pcs', price: 3.4, category: 'eggs', isFood: true, confidence: 0.96 },
    { sourceLine: 6, raw: 'CHICKEN BREAST 500G', name: 'Chicken breast', quantity: 500, unit: 'g', price: 5.25, category: 'meat', isFood: true, confidence: 0.95 },
    { sourceLine: 7, raw: 'BABY SPINACH 200G', name: 'Baby spinach', quantity: 200, unit: 'g', price: 1.8, category: 'vegetable', isFood: true, confidence: 0.94 },
    { sourceLine: 8, raw: 'STRAWBERRIES 400G', name: 'Strawberries', quantity: 400, unit: 'g', price: 2.99, category: 'fruit', isFood: true, confidence: 0.95 },
    { sourceLine: 9, raw: 'CHEDDAR CHEESE 400G', name: 'Cheddar', quantity: 400, unit: 'g', price: 3.75, category: 'dairy', isFood: true, confidence: 0.93 },
    { sourceLine: 10, raw: 'SOURDOUGH LOAF', name: 'Sourdough loaf', quantity: 1, unit: 'pcs', price: 2.6, category: 'bakery', isFood: true, confidence: 0.88 },
    { sourceLine: 11, raw: 'BANANAS 1KG', name: 'Bananas', quantity: 1, unit: 'kg', price: 1.1, category: 'fruit', isFood: true, confidence: 0.92 },
    { sourceLine: 12, raw: 'GREEK YOGURT 500G', name: 'Greek yogurt', quantity: 500, unit: 'g', price: 2.3, category: 'dairy', isFood: true, confidence: 0.94 },
    // One row left uncertain on purpose, so the demo shows how low-confidence rows are flagged.
    { sourceLine: 13, raw: 'CARROTS 1KG', name: 'Carrots', quantity: 1, unit: 'kg', price: 0.95, category: 'vegetable', isFood: true, confidence: 0.64 },
  ],
};

/** A photo of one item: no printed date, so the app's estimate counts only half the usual shelf life. */
export const DEMO_ITEM_PHOTO: ItemPhotoResult = {
  lines: [{ name: 'Avocado', quantity: 1, unit: 'pcs', category: 'fruit', confidence: 0.9, expires: null }],
  warnings: [],
};

export const DEMO_BARCODE = (code: string): BarcodeProduct => ({ code, name: 'Hummus', brand: null, category: 'condiment', qty: 200, unit: 'g' });
