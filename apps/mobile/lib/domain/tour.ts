/**
 * The guided tour: the whole story of the app in eight stops, for a first look or a demo. Each stop names
 * the screen it's about and, where the user should do something, the screen that doing it leads to, so
 * the tour moves on by itself when they do.
 */
export interface TourStep {
  id: string;
  /** The screen this stop is about; "Next" from the stop before goes here. */
  route: string;
  title: string;
  body: string;
  /** Doing what the stop asks lands here, which moves the tour on. */
  advanceOn?: string;
  /** What to tap, said plainly, for when the user would rather do it themselves. */
  doIt?: string;
}

export const TOUR: TourStep[] = [
  {
    id: 'kitchen', route: '/', title: 'A fridge that haunts you',
    body: 'Doors standing ajar have food turning behind them, and a ghost peeks out when something needs you. Poke a ghost to open the most urgent food.',
  },
  {
    id: 'scan', route: '/scan', title: 'One photo stocks the fridge', advanceOn: '/review',
    body: 'A receipt photo is read into items, prices and the currency, and each food gets a conservative shelf life.',
    doIt: 'Tap "Use the sample receipt".',
  },
  {
    id: 'review', route: '/review', title: 'Nothing goes in unchecked', advanceOn: '/',
    body: 'Uncertain rows are flagged, food you already have is called out, and every date stays marked "est." until you check the pack.',
    doIt: 'Tap "Confirm & stock fridge".',
  },
  {
    id: 'voice', route: '/', title: 'Log it by voice',
    body: 'Tap the microphone beside the title and say what happened, like "used half the milk and two eggs". You check what was understood before anything changes.',
  },
  {
    id: 'recipes', route: '/recipes', title: 'Cook what is turning first',
    body: 'Real recipes ranked by how much turning food they rescue, filtered by your diets. Spoiled food, and meat or dairy past its date, is never used.',
  },
  {
    id: 'plan', route: '/plan', title: 'Three days, nothing wasted',
    body: '"Plan the next 3 days" picks the meals that use the most turning food between them. The shopping list warns you before you buy what you already have.',
  },
  {
    id: 'ledger', route: '/ledger', title: 'Waste you can measure',
    body: 'Money spent, rescued and thrown away, with the CO₂ and water behind it, your badges, and a picture of your week to share.',
  },
  {
    id: 'trust', route: '/trust', title: 'Rules the AI cannot bend',
    body: 'High-risk food never goes in the pantry, estimates lean short, and diet filters fail closed. These are guidance, not a guarantee: always check the food itself.',
  },
];

/** Where the tour goes after `step` when the user arrives at `path`, or null to stay. */
export function tourAdvance(step: number, path: string): number | null {
  const s = TOUR[step];
  if (!s?.advanceOn) return null;
  return samePath(path, s.advanceOn) && step + 1 < TOUR.length ? step + 1 : null;
}

/** Expo Router reports "/" for the fridge tab and may add a trailing slash on web. */
export const samePath = (a: string, b: string) => (a.replace(/\/+$/, '') || '/') === (b.replace(/\/+$/, '') || '/');

/**
 * The stop after `step` when the user taps Next. Review only makes sense with a scanned receipt, so
 * skipping the scan also skips its review.
 */
export function tourNext(step: number, hasDraft: boolean): number | null {
  let n = step + 1;
  if (TOUR[n]?.route === '/review' && !hasDraft) n++;
  return n < TOUR.length ? n : null;
}

/** The stop before `step` for Back, skipping review the same way (going back to it would make a blank draft). */
export function tourBack(step: number): number {
  let n = step - 1;
  if (TOUR[n]?.route === '/review') n--;
  return Math.max(0, n);
}
