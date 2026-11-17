import { describe, expect, it } from 'vitest';
import type { Item, ItemEvent } from '@/lib/domain/types';
import { APP_STORE_VERSION, eventPhoto, FINISHED_KEEP_DAYS, migrateAppData, pruneFinished } from '@/lib/store/migrations';
import { addDays } from '@/lib/domain/dates';

/** What a v1 install saved: emoji, six sections, plain counts, no confirmation flags. */
const v1 = () => ({
  items: [
    { id: 'i1', name: 'Milk', emoji: '🥛', zone: 'door', qty: 2, photoUri: 'data:image/jpeg;base64,AAA' },
    { id: 'i2', name: 'Peas', emoji: '🫛', zone: 'freezer', qty: 0 },
    { id: 'i3', name: 'Rice', zone: 'pantry', unit: 'kg', qty: 1, expiryConfirmed: false },
  ],
  events: [
    { id: 'e1', name: 'Milk', emoji: '🥛', photoUri: 'data:image/jpeg;base64,AAA' },
    { id: 'e2', name: 'Bread', photoUri: 'data:image/jpeg;base64,BBB' },
  ],
  quota: { used: 3 },
});

describe('fridge store migrations', () => {
  it('upgrades a v1 install all the way without losing an item, a history entry or a photo', () => {
    const out = migrateAppData(v1(), 1);
    expect(out.items).toHaveLength(3);
    expect(out.events).toHaveLength(2);
    const [milk, peas, rice] = out.items!;
    expect(milk).toMatchObject({ zone: 'fridge', unit: 'pcs', qty: 2, expiryConfirmed: true, photoUri: 'data:image/jpeg;base64,AAA' });
    expect(milk).not.toHaveProperty('emoji');
    expect(peas).toMatchObject({ zone: 'freezer', qty: 1 });
    expect(rice).toMatchObject({ zone: 'pantry', unit: 'kg', expiryConfirmed: false });
    expect(out).not.toHaveProperty('quota');
    expect(out).toMatchObject({ shopping: [], plan: [] });
  });
  it('v8: an entry whose photo is its item\'s points at the item instead of copying it', () => {
    const out = migrateAppData(v1(), 7);
    const [e1, e2] = out.events!;
    expect(e1).toMatchObject({ itemId: 'i1' });
    expect(e1).not.toHaveProperty('photoUri');
    // No item has Bread's photo any more: the entry keeps it, so the picture isn't lost.
    expect(e2).toMatchObject({ photoUri: 'data:image/jpeg;base64,BBB' });
  });
  it('each step only runs for older data', () => {
    const current = { items: [{ id: 'x', zone: 'door', qty: 0 }], events: [], shopping: ['keep'], plan: [] };
    expect(migrateAppData(structuredClone(current), APP_STORE_VERSION)).toEqual(current);
  });
  it('copes with nothing saved', () => {
    expect(migrateAppData(undefined, 0)).toMatchObject({ items: [], events: [], shopping: [], plan: [] });
  });
});

describe('pruning finished items', () => {
  const now = '2026-11-17';
  const base = { name: 'x', category: 'produce', zone: 'fridge', highRisk: false, qty: 1, unit: 'pcs', priceMinor: 0, currency: 'USD', purchased: '2026-01-01', shelfDays: 5, expirySource: 'user', expiryConfirmed: true, fraction: 0 } as const;
  const it_ = (id: string, status: Item['status'], expires: string, photoUri?: string): Item => ({ ...base, id, status, expires, photoUri });
  const ev = (itemId: string, date: string): ItemEvent => ({ id: `e-${itemId}`, type: 'used', name: 'x', category: 'produce', itemId, minor: 0, currency: 'USD', stage: 'fresh', date });

  it('keeps active items and recently finished ones; drops old finished ones and frees their photos', () => {
    const old = addDays(now, -(FINISHED_KEEP_DAYS + 5));
    const items = [it_('active', 'active', old), it_('recent', 'used', old, 'p1'), it_('old', 'used', old, 'p2'), it_('oldBinned', 'discarded', old)];
    const { items: kept, photos } = pruneFinished(items, [ev('recent', addDays(now, -10)), ev('old', old)], now);
    expect(kept.map((i) => i.id)).toEqual(['active', 'recent']);
    expect(photos).toEqual(['p2']);
  });
  it('returns the same array when nothing changes, so the store is not rewritten', () => {
    const items = [it_('a', 'active', now)];
    expect(pruneFinished(items, [], now).items).toBe(items);
  });
  it('history photos come from the item, or the entry\'s own for older entries', () => {
    const byId = new Map([['a', it_('a', 'used', now, 'pa')]]);
    expect(eventPhoto(ev('a', now), byId)).toBe('pa');
    expect(eventPhoto({ ...ev('gone', now), photoUri: 'own' }, byId)).toBe('own');
    expect(eventPhoto(ev('gone', now), byId)).toBeUndefined();
  });
});
