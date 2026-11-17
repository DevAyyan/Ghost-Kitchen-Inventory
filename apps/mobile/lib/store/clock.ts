import { today } from '@/lib/domain/dates';
import { AppState } from 'react-native';
import { create } from 'zustand';

/**
 * Today's date as state. Freshness ("1 day left", stages, the haunting count) is worked out from the date
 * at render time, so without this an app left open overnight would show yesterday's stages until
 * something else re-rendered. Components that show stages read `useDay` to re-render when it turns.
 */
export const useDay = create<{ day: string }>(() => ({ day: today() }));

const tick = () => {
  const d = today();
  if (d !== useDay.getState().day) useDay.setState({ day: d });
};

/** Checks every minute and when the app comes back to the foreground. Call once from the root layout. */
export function startClock(): () => void {
  const id = setInterval(tick, 60_000);
  const sub = AppState.addEventListener('change', (s) => { if (s === 'active') tick(); });
  return () => { clearInterval(id); sub.remove(); };
}
