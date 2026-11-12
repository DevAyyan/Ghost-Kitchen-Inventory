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
  if (w.rescuedCount) parts.push(`You rescued ${fmt(w.rescued)} of food`);
  if (w.wastedCount) parts.push(`${w.rescuedCount ? 'and' : 'You'} threw out ${fmt(w.wasted)} (${w.wastedCount} item${w.wastedCount === 1 ? '' : 's'})`);
  if (!parts.length) parts.push('Nothing rescued or thrown out');
  let trend = '';
  if (w.previous.wastedCount > 0 || w.wastedCount > 0) {
    if (w.wastedCount < w.previous.wastedCount) trend = ' Less waste than the week before.';
    else if (w.wastedCount > w.previous.wastedCount) trend = ' More waste than the week before.';
  }
  const worst = w.topWasted[0] && w.topWasted[0].count > 1 ? ` Most binned: ${w.topWasted[0].name}.` : '';
  return { title: `Your week in food (${range})`, body: `${parts.join(' ')}.${trend}${worst}` };
}
