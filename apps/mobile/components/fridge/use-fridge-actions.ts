import { formatMoney } from '@/lib/currency/money';
import { ZONES } from '@/lib/domain/catalog';
import { shortDate } from '@/lib/domain/dates';
import { isAtRisk, stageOf } from '@/lib/domain/expiry';
import { isForgotten } from '@/lib/domain/haunt';
import { planMove } from '@/lib/domain/storage';
import { suggestMove, type MoveSuggestion } from '@/lib/domain/suggest';
import type { Item } from '@/lib/domain/types';
import { useSummarize } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { toast } from '@/lib/store/toast';
import { sfx } from '@/lib/feedback';

/**
 * What the fridge screen needs to decide on, and the one-tap actions behind it. Shared by the drawn
 * kitchen, the "use first" list and the long-press quick actions, so all three say and do the same.
 */
export function useFridgeActions(items: Item[]) {
  const summarize = useSummarize();
  const consumeItem = useApp((s) => s.consumeItem);
  const discardItem = useApp((s) => s.discardItem);
  const moveItem = useApp((s) => s.moveItem);
  const addShopping = useApp((s) => s.addShopping);
  /** The toast button after binning or burying: put it (or them) back on the shopping list. */
  const restock = (names: string[]) => ({
    label: 'Add to list',
    onPress: () => {
      const added = [...new Set(names)].filter((n) => addShopping(n, { source: 'used-up' })).length;
      toast(added ? `Added to the shopping list` : `Already on the shopping list`);
    },
  });

  const spoiled = items.filter((i) => stageOf(i) === 'spoiled');
  // Dates only need checking once food starts to turn: that's when an estimate drives the warning.
  const estimated = items
    .filter((i) => !i.expiryConfirmed && ['aging', 'expiring', 'rotting'].includes(stageOf(i)))
    .sort((a, b) => a.expires.localeCompare(b.expires));
  // Freezing what's about to turn first, then food that would keep longer elsewhere.
  const moves = items
    .flatMap((item) => { const suggestion = suggestMove(item); return suggestion ? [{ item, suggestion }] : []; })
    .sort((a, b) => (a.suggestion.kind === b.suggestion.kind ? a.item.expires.localeCompare(b.item.expires) : a.suggestion.kind === 'save' ? -1 : 1));
  const forgotten = items.filter((i) => isForgotten(i, stageOf(i)));
  const turning = items.filter((i) => isAtRisk(stageOf(i)));
  const atRisk = summarize(turning.map((i) => ({ minor: Math.round(i.priceMinor * i.fraction), currency: i.currency })));

  const moveNow = (item: Item, s: MoveSuggestion) => {
    const plan = planMove(item, s.to);
    if (!plan.ok) { toast(plan.reason); return; }
    // The new date is an estimate for the new section, so it stays marked "est." until checked.
    moveItem(item.id, plan.to, plan.expires, plan.shelfDays, false);
    toast(`${item.name} moved to the ${ZONES[plan.to].label.toLowerCase()} · keeps until ${shortDate(plan.expires)}`);
  };
  const usedAll = (item: Item) => {
    const res = consumeItem(item.id, item.qty * item.fraction);
    if (res) toast(`${item.name} used up${res.stage !== 'fresh' && res.value > 0 ? ` · ${formatMoney(res.value, item.currency)} rescued` : ''}`);
    return !!res;
  };
  const binned = (item: Item) => {
    const res = discardItem(item.id);
    if (res) { sfx('bury'); toast(`${item.name} buried · ${formatMoney(res.value, res.currency)} lost`, restock([item.name])); }
    return !!res;
  };
  const buryAll = () => {
    const lost = spoiled.map((i) => discardItem(i.id)).filter((x) => x !== null);
    const text = lost.length === 1 ? formatMoney(lost[0]!.value, lost[0]!.currency) : summarize(lost.map((l) => ({ minor: l!.value, currency: l!.currency }))).text;
    if (lost.length) sfx('bury');
    toast(`${lost.length} buried · ${text} lost`, lost.length ? restock(spoiled.map((i) => i.name)) : undefined);
  };

  return { spoiled, estimated, moves, forgotten, turning, atRisk, moveNow, usedAll, binned, buryAll };
}
