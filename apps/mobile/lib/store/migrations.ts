import { addDays } from '@/lib/domain/dates';
import type { IsoDate, Item, ItemEvent } from '@/lib/domain/types';

/**
 * Persisted-data upgrades for the fridge store (app-store.ts). Pure, so every step is unit tested:
 * a broken migration loses people's food, history and photos.
 */

export const APP_STORE_VERSION = 8;

type Raw = Record<string, unknown> & { items?: Record<string, unknown>[]; events?: Record<string, unknown>[] };

export function migrateAppData(persisted: unknown, version: number): Raw {
  const s = (persisted && typeof persisted === 'object' ? persisted : {}) as Raw;
  // v1 stored emoji and had no expiry confirmation. Earlier dates came from the user's own
  // receipts, so treat them as confirmed rather than nagging about every old item.
  if (version < 2) {
    s.items = (s.items ?? []).map(({ emoji: _e, ...i }) => ({ ...i, expiryConfirmed: i.expiryConfirmed ?? true }));
    s.events = (s.events ?? []).map(({ emoji: _e, ...e }) => ({ ...e, category: e.category ?? 'other' }));
  }
  // v2 had six fridge sections. (Its settings changes are migrated in settings-store.ts.)
  if (version < 3) {
    s.items = (s.items ?? []).map((i) => ({ ...i, zone: i.zone === 'freezer' || i.zone === 'pantry' ? i.zone : 'fridge' }));
  }
  // v3 had a fake AI quota counter.
  if (version < 4) delete s.quota;
  // v4 had no units: quantities were plain counts.
  if (version < 5) {
    s.items = (s.items ?? []).map((i) => ({ ...i, unit: i.unit ?? 'pcs', qty: Number(i.qty) > 0 ? i.qty : 1 }));
  }
  // v6 had no shopping list or meal plan.
  if (version < 7) {
    s.shopping = Array.isArray(s.shopping) ? s.shopping : [];
    s.plan = Array.isArray(s.plan) ? s.plan : [];
  }
  // v7 copied the item's photo into every history entry: on web that's a whole image per use, which filled
  // browser storage. Entries now point at their item instead. A photo is only kept on an entry when no
  // item has it any more, so no picture is lost.
  if (version < 8) {
    const byPhoto = new Map<unknown, string>();
    for (const i of s.items ?? []) if (i.photoUri) byPhoto.set(i.photoUri, String(i.id));
    s.events = (s.events ?? []).map((e) => {
      if (!e.photoUri) return e;
      const itemId = byPhoto.get(e.photoUri);
      if (!itemId) return e;
      const { photoUri: _p, ...rest } = e;
      return { ...rest, itemId };
    });
  }
  return s;
}

/** Finished (used or thrown away) items are kept this long after their last history entry, for its photo. */
export const FINISHED_KEEP_DAYS = 90;

/**
 * Drops finished items nobody needs any more: no history entry from the last FINISHED_KEEP_DAYS points at
 * them. Returns the items to keep and the photos that can be deleted. Active items are never touched.
 */
export function pruneFinished(items: Item[], events: ItemEvent[], now: IsoDate): { items: Item[]; photos: string[] } {
  const cutoff = addDays(now, -FINISHED_KEEP_DAYS);
  const lastUse = new Map<string, IsoDate>();
  for (const e of events) {
    if (!e.itemId) continue;
    const prev = lastUse.get(e.itemId);
    if (!prev || e.date > prev) lastUse.set(e.itemId, e.date);
  }
  const photos: string[] = [];
  const kept = items.filter((i) => {
    if (i.status === 'active') return true;
    const last = lastUse.get(i.id) ?? i.expires;
    if (last >= cutoff) return true;
    if (i.photoUri) photos.push(i.photoUri);
    return false;
  });
  return { items: kept.length === items.length ? items : kept, photos };
}

/** The photo for a history entry: its own (older entries), else its item's. */
export function eventPhoto(e: ItemEvent, itemsById: Map<string, Item>): string | undefined {
  return e.photoUri ?? (e.itemId ? itemsById.get(e.itemId)?.photoUri : undefined);
}
