import { ZONES } from './catalog';
import { addDays, today } from './dates';
import { daysLeft, lifeOf, stageOf } from './expiry';
import type { IsoDate, Item, Zone } from './types';

export type MovePlan =
  | { ok: true; to: Zone; expires: IsoDate; shelfDays: number; note: string; warning?: string }
  | { ok: false; to: Zone; reason: string };

/** Thawed food spoils like fresh food: use soon (USDA: 1–2 days for thawed raw meat and fish). */
const THAW_DAYS_HIGH_RISK = 2;
const THAW_DAYS_OTHER = 3;

const BLOCK_REASON = (item: Item, to: Zone) => {
  if (to === 'pantry' && item.highRisk) return `${item.name} must stay cold. Keep it in the fridge or freezer.`;
  if (to === 'freezer' && item.category === 'eggs') return "Eggs in their shells can't be frozen.";
  if (to === 'freezer') return `${item.name} doesn't freeze well.`;
  if (item.category === 'frozen') return `${item.name} melts or thaws outside the freezer. Keep it frozen.`;
  return `${item.name} shouldn't be kept in the ${ZONES[to].label.toLowerCase()}.`;
};

/**
 * What happens to an item's expiry when it moves section.
 * - Into the freezer: the clock is paused; expiry becomes the frozen best-quality limit from today.
 * - Out of the freezer: thawed food gets a short window (capped by the destination's shelf life).
 * - Fridge ↔ pantry: the remaining days scale by the ratio of the two shelf lives.
 * Spoiled food (and rotting high-risk food) can't be moved: freezing doesn't undo spoilage.
 */
export function planMove(item: Item, to: Zone, now: IsoDate = today()): MovePlan {
  const from = item.zone;
  const life = lifeOf(item.category, null, item.life);
  const stage = stageOf(item, now);
  if (stage === 'spoiled' || (stage === 'rotting' && item.highRisk)) {
    return { ok: false, to, reason: 'This has spoiled. Moving or freezing it will not make it safe. Discard it instead.' };
  }
  if (to === 'freezer' && stage === 'rotting') {
    return { ok: false, to, reason: 'Freezing does not reverse spoilage. Use it today or discard it.' };
  }
  const target = life[to];
  // High-risk food never goes in the pantry, whatever a shelf-life table says (food-safety floor).
  if (to === 'pantry' && item.highRisk) return { ok: false, to, reason: BLOCK_REASON(item, to) };
  if (target === null) return { ok: false, to, reason: BLOCK_REASON(item, to) };

  if (to === 'freezer') {
    const months = Math.round(target / 30);
    return {
      ok: true, to, expires: addDays(now, target), shelfDays: target,
      note: `Freezing pauses spoilage. Best quality for about ${months > 1 ? `${months} months` : `${target} days`}.`,
      warning: ['vegetable', 'fruit', 'herbs', 'produce'].includes(item.category) ? 'Fresh produce thaws soft, so it is best for cooking or smoothies.' : undefined,
    };
  }

  if (from === 'freezer') {
    const cap = item.category === 'dry' ? target : item.highRisk ? THAW_DAYS_HIGH_RISK : THAW_DAYS_OTHER;
    const days = Math.min(target, cap);
    return {
      ok: true, to, expires: addDays(now, days), shelfDays: days,
      note: `Once thawed, use within ${days} day${days === 1 ? '' : 's'}. Don't refreeze raw food that thawed outside the fridge.`,
    };
  }

  const fromLife = life[from] ?? target;
  const rem = Math.max(0, daysLeft(item, now));
  const scaled = Math.max(item.highRisk ? 0 : 1, Math.round((rem * target) / Math.max(1, fromLife)));
  const shelfDays = Math.max(1, Math.round((item.shelfDays * target) / Math.max(1, fromLife)));
  const faster = target < fromLife;
  return {
    ok: true, to, expires: addDays(now, scaled), shelfDays,
    note: faster
      ? `It keeps for less time in the ${ZONES[to].label.toLowerCase()} (about ${target} days instead of ${fromLife}).`
      : `It keeps longer in the ${ZONES[to].label.toLowerCase()} (about ${target} days instead of ${fromLife}).`,
    warning: item.life ? undefined : 'This uses a rough estimate for this kind of food, so check the package.',
  };
}
