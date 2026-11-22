import { useApp } from './app-store';

/**
 * When each food item first appeared while the app was open: added here, or arriving from another device
 * in the same kitchen. Items loaded at start-up don't count, so opening the app doesn't make every tile
 * drop in. Kept in memory only.
 */
const arrivedAt = new Map<string, number>();
const SHOW_MS = 4_000;

export function startArrivals(): () => void {
  return useApp.subscribe((next, prev) => {
    if (next.items === prev.items) return;
    const before = new Set(prev.items.map((i) => i.id));
    const now = Date.now();
    for (const i of next.items) if (!before.has(i.id)) arrivedAt.set(i.id, now);
    // Forget the old ones so this stays small.
    for (const [id, at] of arrivedAt) if (now - at > SHOW_MS) arrivedAt.delete(id);
  });
}

/** True if the item arrived in the last few seconds: its tile drops onto the shelf when it first shows. */
export const justArrived = (id: string) => {
  const at = arrivedAt.get(id);
  return at !== undefined && Date.now() - at < SHOW_MS;
};
