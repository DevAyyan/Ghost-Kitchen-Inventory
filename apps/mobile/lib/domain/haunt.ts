import { daysBetween, today } from './dates';
import type { IsoDate, Item, Stage } from './types';

/**
 * The "costume" layer: which spooky effect an item wears. Every effect stands for a real state, so the
 * decoration carries information (and each one is also spelled out in the item's accessible label).
 * Freshness rules themselves live in expiry.ts; nothing here changes what is safe to eat.
 */

/** Full and untouched for this long means it has been forgotten at the back of the shelf. */
export const FORGOTTEN_DAYS = 21;

/** Days since purchase for an item nobody has used any of yet, or null once some of it was used. */
export function untouchedDays(item: Pick<Item, 'purchased' | 'fraction'>, now: IsoDate = today()): number | null {
  if (item.fraction < 1) return null;
  return Math.max(0, daysBetween(item.purchased, now));
}

/** Cobwebs: forgotten food. Spoiled food already has its ghost, so it doesn't also get webs. */
export function isForgotten(item: Pick<Item, 'purchased' | 'fraction'>, stage: Stage, now: IsoDate = today()): boolean {
  const days = untouchedDays(item, now);
  return stage !== 'spoiled' && days !== null && days >= FORGOTTEN_DAYS;
}

export function forgottenText(days: number): string {
  const weeks = Math.floor(days / 7);
  return `untouched for ${weeks} week${weeks === 1 ? '' : 's'}`;
}

/** Stable pseudo-random numbers from an id, so an item's mould looks the same on every render and device. */
export function seeded(id: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export interface Spot { cx: number; cy: number; r: number; tone: 0 | 1 | 2 }

/**
 * Mould spots on a 100×100 photo. Rotting food grows more and bigger spots the longer it's past its date
 * (rotting covers days 1–3 over; anything later is spoiled and fades out instead).
 */
export function mouldSpots(id: string, daysOver: number): Spot[] {
  const rand = seeded(id);
  const level = Math.min(3, Math.max(1, daysOver));
  // Many small spots read as mould; a few big ones read as paint.
  const count = 4 + level * 3;
  return Array.from({ length: count }, () => ({
    cx: 6 + rand() * 88,
    cy: 6 + rand() * 88,
    r: 2.5 + rand() * (2 + level * 2),
    tone: Math.floor(rand() * 3) as 0 | 1 | 2,
  }));
}

/** Tombstone size by money lost, relative to the costliest grave. Bigger stone, bigger loss. */
export function stoneSize(minor: number, maxMinor: number): 'sm' | 'md' | 'lg' {
  if (maxMinor <= 0) return 'sm';
  const r = minor / maxMinor;
  return r >= 0.66 ? 'lg' : r >= 0.33 ? 'md' : 'sm';
}
