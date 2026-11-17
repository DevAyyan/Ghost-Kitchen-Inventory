import type { RemoteRecipe } from '@/lib/api';
import { cookAmount } from '@/lib/domain/cooking';
import type { Item, Money } from '@/lib/domain/types';
import { formatQty } from '@/lib/domain/units';

/** Fridge items a recipe uses, once each. */
export function recipeItems(r: RemoteRecipe, byId: Map<string, Item>): Item[] {
  return [...new Set(r.ingredients.flatMap((g) => (g.itemId && !g.staple ? [g.itemId] : [])))]
    .map((id) => byId.get(id))
    .filter((i): i is Item => !!i);
}

/** Money this recipe rescues: the share of each non-fresh item it actually uses. */
export function rescuedValue(r: RemoteRecipe, byId: Map<string, Item>): Money[] {
  return r.rescuesItemIds.flatMap((id) => {
    const i = byId.get(id);
    if (!i) return [];
    const used = cookAmount(i, r.uses?.[id]).amount;
    return [{ minor: Math.round((i.priceMinor * used) / Math.max(1e-9, i.qty)), currency: i.currency }];
  });
}

/** "Uses 300 g of Potatoes (1.7 kg stays), all the Spinach. You'll still need feta." */
export function cookSummary(r: RemoteRecipe, byId: Map<string, Item>): string {
  const parts = recipeItems(r, byId).map((i) => {
    const use = cookAmount(i, r.uses?.[i.id]);
    const left = i.qty * i.fraction;
    if (use.amount >= left - 1e-9) return `all the ${i.name}`;
    const stays = formatQty(Math.round((left - use.amount) * 1000) / 1000, i.unit);
    return `${use.basis === 'half' ? 'about half' : formatQty(use.amount, i.unit)} of the ${i.name} (${stays} stays)`;
  });
  return [
    parts.length ? `Uses ${parts.join(', ')}.` : '',
    r.missing.length ? `You'll still need ${r.missing.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
}
