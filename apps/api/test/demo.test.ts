/**
 * Demo mode (apps/mobile/lib/demo) answers from recorded data on the device. These checks keep it honest
 * against the server: the same ingredient matching, and product facts that pass the same safety floor.
 */
import { describe, expect, it } from 'vitest';
import { coversIngredient as clientCovers, isStaple as clientStaple } from '../../mobile/lib/demo/match.js';
import { DEMO_PRODUCTS, DEMO_RECIPE_FITS } from '../../mobile/lib/demo/products.js';
import recorded from '../../mobile/lib/demo/recipes.json' with { type: 'json' };
import { coversIngredient, isStaple } from '../src/match.js';
import { sanitizeProduct } from '../src/products.js';
import { SuggestRequest } from '../src/recipes.js';
import { rescueRequest } from '../../mobile/lib/domain/rescue-plan.js';
import { makeItem } from '../../mobile/lib/domain/expiry.js';
import { addDays } from '../../mobile/lib/domain/dates.js';
import { DIETS, ProductInfo } from '../src/schemas.js';

const NAMES = [
  'Chicken breast', 'Chicken', 'Eggs', 'Egg', 'Free range eggs', 'Baby spinach', 'Spinach', 'Milk', 'Soya milk', 'Coconut milk',
  'Whole milk', 'Butter', 'Peanut butter', 'Strawberries', 'Cherry tomatoes', 'Tomato', 'Tomato Sauce', 'Greek yogurt',
  'Natural Yoghurt', 'Olive Oil', 'Salt', 'Sea Salt', 'Black Pepper', 'Water', 'Banana', 'Bananas', 'Avocado', 'Mushrooms',
  'Carrots', 'Cheddar', 'Parmesan', 'Ground beef', 'Beef', 'Red Pepper', 'Bell pepper',
];

describe('demo mode', () => {
  it('matches ingredients exactly like the server', () => {
    for (const a of NAMES) {
      expect(clientStaple(a), a).toBe(isStaple(a));
      for (const b of NAMES) expect(clientCovers(a, b), `${a} / ${b}`).toBe(coversIngredient(a, b));
    }
  });

  it('has product facts that are valid and that the safety floor leaves unchanged', () => {
    for (const p of DEMO_PRODUCTS) {
      expect(ProductInfo.parse(p), p.name).toEqual(p);
      expect(sanitizeProduct(ProductInfo.parse(p)), p.name).toEqual(p);
    }
  });

  it('lists diets for every recorded recipe, using only real diet names', () => {
    for (const m of recorded as { id: string }[]) {
      expect(DEMO_RECIPE_FITS[m.id], m.id).toBeDefined();
      for (const d of DEMO_RECIPE_FITS[m.id]!) expect(DIETS).toContain(d);
    }
  });

  it('never calls a recipe with meat, fish or animal products vegetarian or vegan', () => {
    const meat = /chicken|beef|pork|bacon|lamb|fish|salmon|tuna|stock|gelatin/i;
    const animal = /milk|cream|butter|cheese|feta|parmesan|ricotta|mascarpone|mozzarella|yog|egg|honey|meringue/i;
    for (const m of recorded as { id: string; ingredients: { name: string }[] }[]) {
      const names = m.ingredients.map((i) => i.name);
      const fits = DEMO_RECIPE_FITS[m.id]!;
      if (names.some((n) => meat.test(n))) expect(fits, m.id).not.toContain('vegetarian');
      if (names.some((n) => meat.test(n) || (animal.test(n) && !/soya|vegan/i.test(n)))) expect(fits, m.id).not.toContain('vegan');
    }
  });
});

describe('3-day plan request', () => {
  const NOW = '2026-11-17';
  const it_ = (name: string, category: 'vegetable' | 'meat', left: number) =>
    makeItem({ name, category, priceMinor: 100, currency: 'GBP', purchased: addDays(NOW, -4), expires: addDays(NOW, left) });
  const fridge = [it_('Spinach', 'vegetable', 1), it_('Carrots', 'vegetable', 20), it_('Lettuce', 'vegetable', -5), it_('Mince', 'meat', -1)];

  it('is a request the server accepts', () => {
    expect(() => SuggestRequest.parse(rescueRequest(fridge, ['vegetarian'], true, NOW).body)).not.toThrow();
  });

  it('never sends spoiled food or high-risk food past its date', () => {
    const names = rescueRequest(fridge, [], true, NOW).body.items.map((i) => i.name);
    expect(names).toEqual(['Spinach', 'Carrots']);
  });
});
