import { foodKey } from './learning';
import type { Item } from './types';
import type { Unit } from './units';

/**
 * Turning "I used half the milk and threw out the spinach" into fridge actions, on the device. Nothing is
 * applied straight away: the app shows what it understood and the user confirms each line.
 */
export type VoiceKind = 'used' | 'binned';

export interface VoiceAction {
  itemId: string;
  name: string;
  kind: VoiceKind;
  /** Amount in the item's unit, capped at what's left. Binning is always the whole item. */
  amount: number;
  unit: Unit;
  /** True when the sentence gave no amount, so "all of it" was assumed and the user should check. */
  assumed: boolean;
}

export interface VoiceResult { actions: VoiceAction[]; unmatched: string[] }

const USED = /\b(used|use|ate|eaten|eat|finished|finish|cooked|cook|had|drank|drunk|drink|made)\b/;
const BINNED = /\b(threw|thrown|throw|binned|bin|tossed|toss|chucked|chuck|buried|bury|went off|gone off|spoiled|spoilt|rotten|mouldy|moldy)\b/;
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12,
};
const FRACTIONS: [RegExp, number][] = [[/\bhalf\b/, 0.5], [/\b(a )?quarter\b/, 0.25], [/\bthree quarters\b/, 0.75], [/\b(a )?third\b/, 1 / 3]];
const ALL = /\b(all|whole|everything|the rest|rest of|entire|last of|finished|finish)\b/;
const UNITS: [RegExp, Unit, number][] = [
  [/^(kg|kgs|kilo|kilos|kilograms?)$/, 'kg', 1], [/^(g|gram|grams|gr)$/, 'g', 1],
  [/^(l|litre|litres|liter|liters)$/, 'l', 1], [/^(ml|millilitres?|milliliters?)$/, 'ml', 1],
];
/** Words that are never food, so "the" or "some" can't match an item called "Some kind of cheese". */
const FILLER = new Set(['i', 'we', 'the', 'of', 'some', 'my', 'our', 'it', 'them', 'up', 'out', 'away', 'and', 'then', 'just', 'a', 'an', 'today', 'yesterday', 'tonight', 'for', 'dinner', 'lunch', 'breakfast']);

/** Converts between units of the same kind; null when they don't mix (grams of eggs). */
function convert(amount: number, from: Unit, to: Unit): number | null {
  if (from === to) return amount;
  if (from === 'g' && to === 'kg') return amount / 1000;
  if (from === 'kg' && to === 'g') return amount * 1000;
  if (from === 'ml' && to === 'l') return amount / 1000;
  if (from === 'l' && to === 'ml') return amount * 1000;
  return null;
}

/** The active item a clause names, preferring the one that goes off first. All its words must be said. */
function findItem(clause: string, items: Item[]): Item | null {
  const said = new Set(foodKey(clause).split(' ').filter((w) => w && !FILLER.has(w)));
  const hits = items.filter((i) => {
    const words = foodKey(i.name).split(' ').filter(Boolean);
    return words.length > 0 && words.every((w) => said.has(w));
  });
  // The most specific name wins ("chicken breast" over "chicken"), then the soonest date.
  hits.sort((a, b) => foodKey(b.name).length - foodKey(a.name).length || a.expires.localeCompare(b.expires));
  return hits[0] ?? null;
}

function amountFor(clause: string, item: Item): { amount: number; assumed: boolean } {
  const left = item.qty * item.fraction;
  for (const [re, f] of FRACTIONS) if (re.test(clause)) return { amount: left * f, assumed: false };
  const m = clause.match(/(\d+(?:[.,]\d+)?)\s*([a-z]+)?/);
  if (m) {
    const n = Number(m[1]!.replace(',', '.'));
    const unit = m[2] ? UNITS.find(([re]) => re.test(m[2]!)) : undefined;
    const inItem = unit ? convert(n, unit[1], item.unit) : item.unit === 'pcs' ? n : null;
    if (inItem !== null && inItem > 0) return { amount: Math.min(left, inItem), assumed: false };
  }
  if (item.unit === 'pcs') {
    const word = clause.split(/\s+/).find((w) => w in NUMBER_WORDS && w !== 'a' && w !== 'an');
    if (word) return { amount: Math.min(left, NUMBER_WORDS[word]!), assumed: false };
  }
  return { amount: left, assumed: !ALL.test(clause) };
}

/**
 * Reads a spoken or typed sentence. Clauses split on "and", commas and "then"; a clause without a verb
 * takes the one before it ("used the milk and two eggs"). Only active items can match.
 */
export function parseVoice(text: string, items: Item[]): VoiceResult {
  const active = items.filter((i) => i.status === 'active' && i.fraction > 0);
  const clauses = text.toLowerCase().replace(/[.!?;]/g, ',').split(/,|\band\b|\bthen\b|\bplus\b/).map((c) => c.trim()).filter(Boolean);
  const actions: VoiceAction[] = [];
  const unmatched: string[] = [];
  let kind: VoiceKind = 'used';
  for (const clause of clauses) {
    if (BINNED.test(clause)) kind = 'binned';
    else if (USED.test(clause)) kind = 'used';
    const item = findItem(clause, active);
    if (!item) { if (/[a-z]{3,}/.test(clause.replace(USED, '').replace(BINNED, ''))) unmatched.push(clause); continue; }
    if (actions.some((a) => a.itemId === item.id)) continue;
    const left = item.qty * item.fraction;
    const { amount, assumed } = kind === 'binned' ? { amount: left, assumed: false } : amountFor(clause, item);
    actions.push({ itemId: item.id, name: item.name, kind, amount: Math.round(amount * 1000) / 1000, unit: item.unit, assumed });
  }
  return { actions, unmatched };
}
