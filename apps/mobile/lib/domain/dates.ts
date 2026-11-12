import type { IsoDate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toIso(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIso(s: IsoDate): Date {
  const [y = 1970, m = 1, d = 1] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): IsoDate {
  return toIso(new Date());
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

/** Whole days from `a` to `b` (positive when b is later). Rounding absorbs DST shifts. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 9". Formatted by hand because Hermes' Intl date support varies by Android build. */
export function shortDate(iso: IsoDate): string {
  const d = parseIso(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon". */
export function weekday(iso: IsoDate): string {
  return DAYS[parseIso(iso).getDay()] ?? '';
}

/** "Today", "Tomorrow", or "Wed Nov 12". */
export function dayLabel(iso: IsoDate, now: IsoDate = today()): string {
  const n = daysBetween(now, iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `${weekday(iso)} ${shortDate(iso)}`;
}

/** The Monday on or before `iso`: weeks run Monday to Sunday. */
export function weekStart(iso: IsoDate): IsoDate {
  const dow = parseIso(iso).getDay(); // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
}
