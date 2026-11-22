import { addDays, today } from './dates';
import { isAtRisk, isCookable, stageOf } from './expiry';
import type { IsoDate, Item } from './types';

export interface Digest {
  /** Local calendar day the message is for. */
  date: IsoDate;
  title: string;
  body: string;
  /** Names it mentions, most urgent first. */
  names: string[];
}

const join = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * The "use it tonight" message for each of the next `days` days, worked out from today's fridge by
 * projecting every item's stage forward. Days with nothing at risk get no message, so the app only
 * speaks up when it has something to say. Local notifications can't compute content when they fire,
 * which is why we schedule a week at a time and refresh on every change.
 */
export function buildDigests(items: Item[], opts: { from?: IsoDate; days?: number } = {}): Digest[] {
  const from = opts.from ?? today();
  const out: Digest[] = [];
  const active = items.filter((i) => i.status === 'active');
  for (let n = 0; n < (opts.days ?? 7); n++) {
    const date = addDays(from, n);
    const due = active
      .filter((i) => isAtRisk(stageOf(i, date)) && isCookable(i, date))
      .sort((a, b) => a.expires.localeCompare(b.expires) || a.name.localeCompare(b.name));
    if (due.length === 0) continue;
    const names = [...new Set(due.map((i) => i.name))];
    const shown = names.slice(0, 3);
    const more = names.length - shown.length;
    out.push({
      date,
      names,
      // Spooky, to match the app, but the facts come first: what, and that it needs cooking soon.
      title: names.length === 1 ? `${names[0]} is starting to turn` : `${names.length} things are stirring in your kitchen`,
      body: names.length === 1
        ? 'Cook it before it haunts the fridge. Tap for tonight\'s idea.'
        : `${join(shown)}${more > 0 ? ` and ${more} more` : ''} need cooking soon. Tap for tonight's idea.`,
    });
  }
  return out;
}
