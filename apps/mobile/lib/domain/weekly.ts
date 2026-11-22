import { addDays, shortDate, weekStart } from './dates';
import { isAtRisk, isCookable, stageOf } from './expiry';
import { learnFromHistory, lessonText } from './learning';
import type { IsoDate, Item, ItemEvent, Money, Receipt } from './types';

/** The weekly digest: what the household spent, rescued and wasted in one Monday–Sunday week. */
export interface WeekSummary {
  start: IsoDate;
  end: IsoDate;
  spent: Money[];
  /** Used while it was turning: money that would otherwise have been wasted. */
  rescued: Money[];
  rescuedCount: number;
  wasted: Money[];
  wastedCount: number;
  /** Most-binned foods this week, most first. */
  topWasted: { name: string; count: number }[];
  previous: { rescued: Money[]; wasted: Money[]; wastedCount: number };
  /** Items that will be at risk in the 7 days from `now`. */
  comingUp: string[];
  /** Plain-language lessons from the learning loop. */
  tips: string[];
}

const within = (d: IsoDate, start: IsoDate) => d >= start && d <= addDays(start, 6);

export function summarizeWeek(input: { events: ItemEvent[]; receipts: Receipt[]; items: Item[]; start: IsoDate; now: IsoDate }): WeekSummary {
  const { events, receipts, items, start, now } = input;
  const ev = events.filter((e) => within(e.date, start));
  const prevStart = addDays(start, -7);
  const prev = events.filter((e) => within(e.date, prevStart));
  const money = (e: ItemEvent): Money => ({ minor: e.minor, currency: e.currency });
  const rescued = ev.filter((e) => e.type === 'used' && e.stage !== 'fresh');
  const wasted = ev.filter((e) => e.type === 'discarded');

  const counts = new Map<string, { name: string; count: number }>();
  for (const e of wasted) {
    const k = e.name.trim().toLowerCase();
    counts.set(k, { name: e.name, count: (counts.get(k)?.count ?? 0) + 1 });
  }
  const comingUp = [...new Set(items
    .filter((i) => i.status === 'active' && isCookable(i, now))
    .filter((i) => [0, 1, 2, 3, 4, 5, 6].some((n) => isAtRisk(stageOf(i, addDays(now, n)))))
    .map((i) => i.name))];

  return {
    start,
    end: addDays(start, 6),
    spent: receipts.filter((r) => within(r.date, start)).map((r) => ({ minor: r.totalMinor, currency: r.currency })),
    rescued: rescued.map(money),
    rescuedCount: rescued.length,
    wasted: wasted.map(money),
    wastedCount: wasted.length,
    topWasted: [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 3),
    previous: {
      rescued: prev.filter((e) => e.type === 'used' && e.stage !== 'fresh').map(money),
      wasted: prev.filter((e) => e.type === 'discarded').map(money),
      wastedCount: prev.filter((e) => e.type === 'discarded').length,
    },
    comingUp,
    tips: [...learnFromHistory(events, now).values()].sort((a, b) => b.samples - a.samples).slice(0, 2).map(lessonText),
  };
}

/** The last full week before `now` (the one a Monday digest talks about). */
export const lastWeekStart = (now: IsoDate) => addDays(weekStart(now), -7);

export const hasActivity = (w: WeekSummary) => w.spent.length > 0 || w.rescuedCount > 0 || w.wastedCount > 0;

/** Notification / card text. `fmt` turns a list of amounts into one display string. */
export function weekMessage(w: WeekSummary, fmt: (m: Money[]) => string): { title: string; body: string } {
  const range = `${shortDate(w.start)} – ${shortDate(w.end)}`;
  const parts: string[] = [];
  if (w.rescuedCount) parts.push(`You saved ${fmt(w.rescued)} of food from the graveyard`);
  if (w.wastedCount) parts.push(`${w.rescuedCount ? 'and' : 'You'} buried ${fmt(w.wasted)} (${w.wastedCount} item${w.wastedCount === 1 ? '' : 's'})`);
  if (!parts.length) parts.push('A quiet week: nothing saved or buried');
  let trend = '';
  if (w.previous.wastedCount > 0 || w.wastedCount > 0) {
    if (w.wastedCount < w.previous.wastedCount) trend = ' Less waste than the week before.';
    else if (w.wastedCount > w.previous.wastedCount) trend = ' More waste than the week before.';
  }
  const worst = w.topWasted[0] && w.topWasted[0].count > 1 ? ` Most binned: ${w.topWasted[0].name}.` : '';
  return { title: `Your week in the haunted kitchen (${range})`, body: `${parts.join(' ')}.${trend}${worst}` };
}

/**
 * A short, shareable "ghost story" of the week. Only counts and money the user chose to share; no item
 * photos, no household names. Says nothing about whether food past its date was safe.
 */
export function weekStory(w: WeekSummary, fmt: (m: Money[]) => string, extra?: { co2SavedKg?: number }): string {
  const lines: string[] = [`👻 A week in my haunted kitchen (${shortDate(w.start)} – ${shortDate(w.end)})`];
  if (w.rescuedCount) {
    lines.push(`I banished ${w.rescuedCount} ghost${w.rescuedCount === 1 ? '' : 's'}: ${fmt(w.rescued)} of food eaten before it could turn.`);
  }
  if (extra?.co2SavedKg && extra.co2SavedKg >= 0.1) {
    lines.push(`That kept about ${extra.co2SavedKg < 1 ? `${Math.round(extra.co2SavedKg * 1000)} g` : `${extra.co2SavedKg.toFixed(1)} kg`} of CO₂e out of the bin.`);
  }
  if (w.wastedCount) {
    const worst = w.topWasted[0]?.name;
    lines.push(`${w.wastedCount} went to the graveyard (${fmt(w.wasted)})${worst ? `, ${worst} among them` : ''}.`);
  } else if (w.rescuedCount) {
    lines.push('The graveyard stayed empty. 🪦');
  }
  if (!w.rescuedCount && !w.wastedCount) lines.push('A quiet week. Nothing rose, nothing was buried.');
  if (w.wastedCount < w.previous.wastedCount) lines.push(`Fewer burials than the week before (${w.wastedCount} vs ${w.previous.wastedCount}).`);
  lines.push('Tracked with Ghost Kitchen.');
  return lines.join('\n');
}

export interface BoardRow { by: string; rescued: number; buried: number }

/**
 * Who rescued the most food this week, for a household. Ranked by rescues only: burying spoiled food is
 * the right call, so it's shown but never counts against anyone. Entries without a person are left out.
 */
export function householdBoard(events: ItemEvent[], start: IsoDate): BoardRow[] {
  const rows = new Map<string, BoardRow>();
  for (const e of events) {
    if (!e.by || !within(e.date, start)) continue;
    const r = rows.get(e.by) ?? { by: e.by, rescued: 0, buried: 0 };
    if (e.type === 'used' && e.stage !== 'fresh') r.rescued++;
    if (e.type === 'discarded') r.buried++;
    rows.set(e.by, r);
  }
  return [...rows.values()].filter((r) => r.rescued + r.buried > 0).sort((a, b) => b.rescued - a.rescued || a.by.localeCompare(b.by));
}
