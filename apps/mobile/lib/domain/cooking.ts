import type { Item, Unit } from './types';

/** How much of an item a recipe uses, and whether we know that from the recipe or had to guess. */
export interface CookUse {
  itemId: string;
  amount: number;
  /** recipe: read from the recipe's measure; half / all: the recipe didn't say, so a rule was used. */
  basis: 'recipe' | 'half' | 'all';
}

/**
 * The amount of `item` a recipe takes. The recipe's own measure wins when the server could read it in the
 * item's unit (300 g of a 2 kg bag is 0.3, not the whole bag). Otherwise packs that last several meals are
 * half used and everything else is used up, as before. Never more than what's left, never nothing.
 */
export function cookAmount(item: Item, fromRecipe?: { amount: number; unit: Unit }): CookUse {
  const left = item.qty * item.fraction;
  if (fromRecipe && fromRecipe.unit === item.unit && fromRecipe.amount > 0) {
    const want = item.unit === 'pcs' ? Math.max(1, Math.round(fromRecipe.amount)) : fromRecipe.amount;
    return { itemId: item.id, amount: Math.min(left, want), basis: 'recipe' };
  }
  if (item.multiUse) {
    const half = item.unit === 'pcs' ? Math.max(1, Math.round(left / 2)) : left / 2;
    return { itemId: item.id, amount: Math.min(left, half), basis: 'half' };
  }
  return { itemId: item.id, amount: left, basis: 'all' };
}
