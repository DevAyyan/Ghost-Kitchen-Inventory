import { daysBetween } from './dates';
import type { IsoDate, ItemEvent } from './types';

/**
 * The learning loop. When this household keeps throwing a food out before its date, new estimates for
 * that food get shorter. Food-safety rule: it only ever shortens an estimate, never lengthens one, and
 * it never touches a date the user confirmed or one printed on the pack.
 */

/**
 * Words that describe how a food was bought, not which food it is. Removed so "Baby spinach", "Fresh
 * spinach" and "spinach" share what was learned. Kept short on purpose: "sweet potato" must stay apart.
 */
const PACK_WORDS = new Set([
  'fresh', 'organic', 'baby', 'free', 'range', 'large', 'small', 'medium', 'loose', 'pack', 'bag', 'value',
  'premium', 'british', 'local', 'whole', 'ripe', 'bunch', 'of', 'the', 'a',
]);

/** Naive singular for the last word of a food name: "tomatoes" -> "tomato", "berries" -> "berry". */
function singularWord(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (/(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

/**
 * Same food, however it was typed: "Baby Spinach ", "spinach" and "Fresh spinach" share what was learned;
 * "Cherry tomatoes" and "cherry tomato" too. Falls back to the plain name if every word was a pack word.
 */
export const foodKey = (name: string) => {
  const words = name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !PACK_WORDS.has(w));
  const use = kept.length ? kept : words;
  if (use.length) use[use.length - 1] = singularWord(use[use.length - 1]!);
  return use.join(' ');
};

/** One early bin could be bad luck; two is a pattern. */
export const MIN_SAMPLES = 2;
/** Never cut an estimate below half: a big cut from little data would make every date look urgent. */
export const MIN_FACTOR = 0.5;
/** Ignore cuts too small to matter (and to show). */
const MAX_FACTOR = 0.9;
/** Old habits fade: a pack bought last year in a different fridge says little about now. */
export const LEARNING_WINDOW_DAYS = 180;

export interface Learned {
  /** Multiply the usual shelf life by this (MIN_FACTOR..MAX_FACTOR). */
  factor: number;
  samples: number;
  /** The name as the user last wrote it, for messages. */
  name: string;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** What the household's history says about how long each food really lasts, keyed by foodKey. */
export function learnFromHistory(events: ItemEvent[], now: IsoDate): Map<string, Learned> {
  const ratios = new Map<string, { name: string; r: number[] }>();
  for (const e of events) {
    if (e.type !== 'discarded' || !e.wentOff || !e.purchased || !e.shelfDays || e.shelfDays <= 0) continue;
    if (daysBetween(e.date, now) > LEARNING_WINDOW_DAYS) continue;
    const lasted = Math.max(0, daysBetween(e.purchased, e.date));
    const key = foodKey(e.name);
    const entry = ratios.get(key) ?? { name: e.name, r: [] };
    entry.r.push(Math.min(1, lasted / e.shelfDays));
    ratios.set(key, entry);
  }
  const out = new Map<string, Learned>();
  for (const [key, { name, r }] of ratios) {
    if (r.length < MIN_SAMPLES) continue;
    const factor = Math.max(MIN_FACTOR, median(r));
    if (factor <= MAX_FACTOR) out.set(key, { factor: Math.round(factor * 100) / 100, samples: r.length, name });
  }
  return out;
}

/** Shortened shelf life in days (at least 1). Without a lesson, the usual figure. */
export function learnedShelfDays(shelfDays: number, lesson: Learned | undefined): number {
  if (!lesson) return shelfDays;
  return Math.max(1, Math.min(shelfDays, Math.floor(shelfDays * lesson.factor)));
}

/** Plain message for the review screen and the weekly digest. */
export function lessonText(l: Learned): string {
  const pct = Math.round((1 - l.factor) * 100);
  return `${l.name} has gone off early ${l.samples} times, so its estimate is ${pct}% shorter.`;
}
