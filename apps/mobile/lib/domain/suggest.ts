import { ZONES } from './catalog';
import { homeZone, lifeOf, stageOf } from './expiry';
import { planMove } from './storage';
import type { IsoDate, Item, Zone } from './types';
import { today } from './dates';

export interface MoveSuggestion {
  to: Zone;
  /** save: about to turn, freezing rescues it. longer: it would simply keep longer elsewhere. */
  kind: 'save' | 'longer';
  /** One short line each: "Freeze Avocado" / "Keeps about 6 months frozen". */
  title: string;
  detail: string;
  /** Extra advice for the item sheet only (e.g. how frozen produce thaws). */
  note?: string;
}

/** Only worth a nudge when the other section gives at least this many times the shelf life. */
const LONGER_RATIO = 2;

/**
 * The one storage move worth suggesting for an item, or null. Uses the same rules as moving it by hand
 * (planMove), so it never suggests something unsafe: spoiled food, rotting food into the freezer, or
 * high-risk food into the pantry. Freezing comes first, because it saves food that's about to turn.
 */
export function suggestMove(item: Item, now: IsoDate = today()): MoveSuggestion | null {
  if (item.status !== 'active') return null;
  const stage = stageOf(item, now);
  const life = lifeOf(item.category, null, item.life);

  if (stage === 'expiring' && item.zone !== 'freezer' && item.category !== 'frozen') {
    const plan = planMove(item, 'freezer', now);
    if (plan.ok) {
      const months = Math.round(plan.shelfDays / 30);
      return {
        to: 'freezer', kind: 'save',
        title: `Freeze ${item.name}`,
        detail: `Keeps about ${months > 1 ? `${months} months` : `${plan.shelfDays} days`} frozen`,
        note: plan.warning,
      };
    }
  }

  if (stage !== 'fresh' && stage !== 'aging') return null;
  const here = life[item.zone];
  if (!here) return null;
  // The usual home first (from Gemini when known), then the other cold option.
  const home = item.home ?? homeZone(item.category);
  const options: Zone[] = [...new Set<Zone>([home, 'fridge', 'pantry'])].filter((z) => z !== item.zone && z !== 'freezer');
  for (const z of options) {
    const there = life[z];
    if (!there || there < here * LONGER_RATIO) continue;
    const plan = planMove(item, z, now);
    if (!plan.ok) continue;
    const times = Math.round(there / here);
    return {
      to: z, kind: 'longer',
      title: `Move ${item.name} to the ${ZONES[z].label.toLowerCase()}`,
      detail: `Keeps about ${times}× longer there (${there} days, not ${here})`,
      note: z === home ? `That's where ${item.name.toLowerCase()} is usually kept.` : undefined,
    };
  }
  return null;
}
