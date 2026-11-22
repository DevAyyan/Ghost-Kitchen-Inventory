import { describe, expect, it } from 'vitest';
import { makeItem } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { parseVoice } from '@/lib/domain/voice';

const item = (name: string, qty: number, unit: Item['unit'], over: Partial<Item> = {}): Item =>
  ({ ...makeItem({ name, category: 'other', priceMinor: 100, currency: 'GBP', purchased: '2026-11-15', qty, unit }), id: name, ...over });
const fridge = [item('Milk', 1, 'l'), item('Eggs', 12, 'pcs'), item('Spinach', 250, 'g'), item('Chicken breast', 0.5, 'kg'), item('Cheddar', 200, 'g')];

describe('voice logging', () => {
  it('reads amounts, fractions and verbs across clauses', () => {
    const r = parseVoice('I used half the milk and two eggs, then threw out the spinach', fridge);
    expect(r.actions).toEqual([
      { itemId: 'Milk', name: 'Milk', kind: 'used', amount: 0.5, unit: 'l', assumed: false },
      { itemId: 'Eggs', name: 'Eggs', kind: 'used', amount: 2, unit: 'pcs', assumed: false },
      { itemId: 'Spinach', name: 'Spinach', kind: 'binned', amount: 250, unit: 'g', assumed: false },
    ]);
  });
  it('converts units and caps at what is left', () => {
    expect(parseVoice('cooked 300g of chicken breast', fridge).actions[0]).toMatchObject({ amount: 0.3, unit: 'kg' });
    expect(parseVoice('ate 900 g cheddar', fridge).actions[0]).toMatchObject({ amount: 200 });
  });
  it('marks a missing amount as assumed, so the user checks it', () => {
    expect(parseVoice('used the cheddar', fridge).actions[0]).toMatchObject({ amount: 200, assumed: true });
    expect(parseVoice('finished the cheddar', fridge).actions[0]).toMatchObject({ amount: 200, assumed: false });
  });
  it('reports what it could not match, and ignores used-up or finished items', () => {
    const r = parseVoice('ate the mango and the eggs', [...fridge.slice(0, 1), { ...fridge[1]!, status: 'used' }]);
    expect(r.actions).toHaveLength(0);
    expect(r.unmatched).toEqual(['ate the mango', 'the eggs']);
  });
  it('prefers the more specific name and the soonest date', () => {
    const items = [item('Chicken', 1, 'kg', { id: 'c1', expires: '2026-11-30' }), item('Chicken breast', 1, 'kg', { id: 'cb' }), item('Milk', 1, 'l', { id: 'm2', expires: '2026-11-18' }), item('Milk', 1, 'l', { id: 'm1', expires: '2026-11-20' })];
    expect(parseVoice('used chicken breast and milk', items).actions.map((a) => a.itemId)).toEqual(['cb', 'm2']);
  });
});
