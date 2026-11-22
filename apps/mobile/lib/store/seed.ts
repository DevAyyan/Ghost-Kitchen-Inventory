import { toMinor } from '@/lib/currency/money';
import { addDays, today } from '@/lib/domain/dates';
import { makeItem, newId } from '@/lib/domain/expiry';
import type { Category, Item, ItemEvent, Receipt, Unit, Zone } from '@/lib/domain/types';

/**
 * Opt-in sample data (Settings → Load sample data, or the empty-fridge screen). Not loaded by default.
 * Each row: [name, category, section, bought N days ago, use-by in N days from today, price, multiUse].
 * Dates are fixed for the demo rather than estimated, and marked as confirmed so the demo isn't full of
 * prompts; a couple are left unconfirmed to show the "check the package" flow.
 */
type Row = [string, Category, Zone, number, number, number, boolean?, boolean?];
const ROWS: Row[] = [
  ['Spinach', 'vegetable', 'fridge', 4, 1, 3.49],
  ['Strawberries', 'fruit', 'fridge', 3, 1, 3.99, false, false],
  ['Avocado', 'fruit', 'pantry', 6, 0, 1.25],
  ['Tomatoes', 'vegetable', 'pantry', 4, 3, 2.99, true],
  ['Bell pepper', 'vegetable', 'fridge', 2, 8, 1.49],
  ['Mushrooms', 'vegetable', 'fridge', 5, 1, 3.29, false, false],
  ['Cucumber', 'vegetable', 'fridge', 9, -2, 1.19],
  ['Cilantro', 'herbs', 'fridge', 12, -5, 0.99],
  ['Milk', 'dairy', 'fridge', 5, 2, 3.89, true],
  ['Greek yogurt', 'dairy', 'fridge', 6, 8, 4.29, true],
  ['Cheddar', 'dairy', 'fridge', 10, 18, 6.49, true],
  ['Eggs', 'eggs', 'fridge', 12, 23, 4.59, true],
  ['Chicken breast', 'meat', 'fridge', 1, 1, 7.99],
  ['Ground beef', 'meat', 'fridge', 4, -2, 6.99],
  ['Bread', 'bakery', 'pantry', 4, 2, 3.49, true],
  ['Onion', 'vegetable', 'pantry', 10, 20, 0.99, true],
  ['Garlic', 'vegetable', 'pantry', 8, 52, 0.79, true],
  ['Potatoes', 'vegetable', 'pantry', 6, 24, 3.99, true],
  // Bought weeks ago and never opened: these show the "forgotten" cobwebs.
  ['Rice', 'dry', 'pantry', 30, 335, 2.89, true],
  ['Frozen peas', 'frozen', 'freezer', 24, 156, 2.49, true],
  ['Ice cream', 'frozen', 'freezer', 9, 51, 5.99, true],
];

/** How much of each sample item was bought. Anything not listed is 1 piece. */
const AMOUNTS: Record<string, [number, Unit]> = {
  Spinach: [250, 'g'], Strawberries: [500, 'g'], Avocado: [2, 'pcs'], Tomatoes: [1, 'kg'], 'Bell pepper': [3, 'pcs'],
  Mushrooms: [400, 'g'], Cucumber: [2, 'pcs'], Milk: [1, 'l'], 'Greek yogurt': [500, 'g'], Cheddar: [200, 'g'], Eggs: [12, 'pcs'],
  'Chicken breast': [0.5, 'kg'], 'Ground beef': [0.5, 'kg'], Onion: [1, 'kg'], Garlic: [3, 'pcs'], Potatoes: [2, 'kg'],
  Rice: [1, 'kg'], 'Frozen peas': [500, 'g'], 'Ice cream': [1, 'l'],
};

/** The currency the sample's prices are written in. */
export const SAMPLE_CURRENCY = 'USD';

export function sampleData(currency: string): { items: Item[]; receipts: Receipt[]; events: ItemEvent[] } {
  const now = today();
  const items = ROWS.map(([name, category, zone, ago, left, price, multiUse = false, confirmed = true]) => {
    const it = makeItem({
      name, category, zone, qty: AMOUNTS[name]?.[0] ?? 1, unit: AMOUNTS[name]?.[1] ?? 'pcs',
      priceMinor: toMinor(price, currency), currency, purchased: addDays(now, -ago),
      expires: addDays(now, left), expiryConfirmed: confirmed, expirySource: confirmed ? 'user' : 'category',
    });
    return { ...it, multiUse };
  });
  const receipts: Receipt[] = [
    { id: newId('r'), store: 'Sample receipt', date: addDays(now, -4), currency, totalMinor: toMinor(38.7, currency) },
  ];
  const events: ItemEvent[] = [
    { id: newId('e'), type: 'used', name: 'Chicken thighs', category: 'meat', minor: toMinor(5.49, currency), currency, amount: 0.6, unit: 'kg', stage: 'expiring', date: addDays(now, -1) },
    { id: newId('e'), type: 'used', name: 'Broccoli', category: 'vegetable', minor: toMinor(2.79, currency), currency, amount: 500, unit: 'g', stage: 'expiring', date: addDays(now, -3) },
    { id: newId('e'), type: 'discarded', name: 'Salmon fillet', category: 'fish', minor: toMinor(8.99, currency), currency, amount: 250, unit: 'g', stage: 'spoiled', date: addDays(now, -2), purchased: addDays(now, -6) },
    { id: newId('e'), type: 'discarded', name: 'Lettuce', category: 'vegetable', minor: toMinor(2.49, currency), currency, amount: 400, unit: 'g', stage: 'spoiled', date: addDays(now, -5), purchased: addDays(now, -14) },
    { id: newId('e'), type: 'discarded', name: 'Sourdough', category: 'bakery', minor: toMinor(4.5, currency), currency, amount: 1, unit: 'pcs', stage: 'spoiled', date: addDays(now, -9), purchased: addDays(now, -16) },
  ];
  return { items, receipts, events };
}
