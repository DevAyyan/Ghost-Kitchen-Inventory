/**
 * Food-safety rules that live in the client's pure domain code (apps/mobile/lib/domain): the sniff test
 * and the learning loop. Tested here because the API package has the test runner.
 */
import { describe, expect, it } from 'vitest';
import { afterSniff, makeItem, MAX_SNIFFS, sniffCheck, stageOf, storableZones } from '../../mobile/lib/domain/expiry.js';
import { addDays } from '../../mobile/lib/domain/dates.js';
import { learnedShelfDays, learnFromHistory, MIN_FACTOR } from '../../mobile/lib/domain/learning.js';
import type { ItemEvent } from '../../mobile/lib/domain/types.js';
import { CATEGORIES, CATEGORY_FALLBACK, HIGH_RISK_CATEGORIES } from '../../mobile/lib/domain/catalog.js';
import { ALWAYS_HIGH_RISK } from '../src/products.js';
import { canOffer, offerText } from '../../mobile/lib/domain/surplus.js';

const NOW = '2026-11-12';
const item = (category: 'produce' | 'dairy' | 'meat' | 'bakery', expiresIn: number, purchasedAgo = 6) =>
  makeItem({ name: 'Thing', category, priceMinor: 100, currency: 'EUR', purchased: addDays(NOW, -purchasedAgo), expires: addDays(NOW, expiresIn) });

describe('sniff test', () => {
  it('never extends high-risk food', () => {
    for (const c of ['dairy', 'meat'] as const) {
      expect(sniffCheck(item(c, 0), NOW)).toEqual({ ok: false, reason: 'high-risk' });
      expect(afterSniff(item(c, -1), NOW)).toBeNull();
    }
  });

  it('never revives spoiled food', () => {
    expect(sniffCheck(item('produce', -4), NOW)).toEqual({ ok: false, reason: 'spoiled' });
  });

  it('waits until the date is a day away', () => {
    expect(sniffCheck(item('produce', 2), NOW)).toEqual({ ok: false, reason: 'too-early' });
    expect(sniffCheck(item('produce', 1), NOW).ok).toBe(true);
  });

  it('keeps an extended item "expiring", never fresh again', () => {
    const next = afterSniff(item('bakery', -2), NOW)!;
    expect(next.expires).toBe(addDays(NOW, 2));
    expect(stageOf(next, NOW)).toBe('expiring');
    expect(next.expirySource).toBe('sniff');
  });

  it(`allows at most ${MAX_SNIFFS} extensions`, () => {
    let it = item('produce', 0);
    for (let n = 0; n < MAX_SNIFFS; n++) it = afterSniff({ ...it, expires: NOW }, NOW)!;
    expect(sniffCheck({ ...it, expires: NOW }, NOW)).toEqual({ ok: false, reason: 'used-up' });
  });
});

const binned = (name: string, lasted: number, shelfDays: number, over: Partial<ItemEvent> = {}): ItemEvent => ({
  id: Math.random().toString(36), type: 'discarded', name, category: 'produce', minor: 100, currency: 'EUR',
  stage: 'fresh', date: NOW, purchased: addDays(NOW, -lasted), shelfDays, wentOff: true, ...over,
});

describe('learning loop', () => {
  it('needs two early bins before changing anything', () => {
    expect(learnFromHistory([binned('Spinach', 3, 6)], NOW).size).toBe(0);
    const l = learnFromHistory([binned('Spinach', 3, 6), binned('spinach ', 4, 6)], NOW).get('spinach');
    expect(l?.factor).toBeCloseTo(0.58, 2);
  });

  it('only ever shortens, and never below half', () => {
    const l = learnFromHistory([binned('Milk', 0, 10), binned('Milk', 1, 10)], NOW).get('milk')!;
    expect(l.factor).toBe(MIN_FACTOR);
    expect(learnedShelfDays(10, l)).toBe(5);
    expect(learnedShelfDays(10, undefined)).toBe(10);
    // Lasting the full shelf life (or longer) teaches nothing.
    expect(learnFromHistory([binned('Rice', 30, 10), binned('Rice', 12, 10)], NOW).size).toBe(0);
  });

  it('ignores food that was just unwanted, and old history', () => {
    expect(learnFromHistory([binned('Kale', 1, 6, { wentOff: undefined }), binned('Kale', 1, 6, { wentOff: undefined })], NOW).size).toBe(0);
    const old = addDays(NOW, -200);
    expect(learnFromHistory([binned('Kale', 1, 6, { date: old, purchased: addDays(old, -1) }), binned('Kale', 1, 6, { date: old, purchased: addDays(old, -1) })], NOW).size).toBe(0);
  });
});

describe('choosing a section when stocking', () => {
  it('never offers the pantry for high-risk food', () => {
    for (const c of ['dairy', 'meat', 'fish', 'eggs', 'leftovers'] as const) expect(storableZones(c)).not.toContain('pantry');
    // Even if the model claims a high-risk food keeps in the pantry.
    const info = { category: 'meat', homeZone: 'fridge', highRisk: false, shelfLifeDays: { fridge: 3, freezer: 120, pantry: 30 } } as never;
    expect(storableZones('meat', info)).not.toContain('pantry');
  });

  it('stores high-risk food asked for the pantry in its usual section instead', () => {
    const meat = makeItem({ name: 'Mince', category: 'meat', priceMinor: 100, currency: 'EUR', purchased: NOW, zone: 'pantry' });
    expect(meat.zone).toBe('fridge');
  });

  it('lets other food go in any section it keeps in', () => {
    expect(storableZones('bakery')).toEqual(expect.arrayContaining(['pantry', 'freezer']));
  });
});

describe('food-safety data (apps/mobile/lib/domain/rules/food-safety.json)', () => {
  it('uses the same high-risk categories as the server floor', () => {
    expect([...HIGH_RISK_CATEGORIES].sort()).toEqual([...ALWAYS_HIGH_RISK].sort());
  });

  it('has a fallback for every category, and never a pantry life for high-risk food', () => {
    for (const c of CATEGORIES) expect(CATEGORY_FALLBACK[c], c).toBeDefined();
    for (const c of HIGH_RISK_CATEGORIES) {
      expect(CATEGORY_FALLBACK[c].life.pantry, c).toBeNull();
      expect(CATEGORY_FALLBACK[c].home, c).not.toBe('pantry');
    }
  });

  it('keeps the fallback short for the foods that make people ill', () => {
    expect(CATEGORY_FALLBACK.meat.life.fridge).toBeLessThanOrEqual(2);
    expect(CATEGORY_FALLBACK.fish.life.fridge).toBeLessThanOrEqual(2);
    expect(CATEGORY_FALLBACK.leftovers.life.fridge).toBeLessThanOrEqual(3);
  });
});

describe('offering surplus food to others', () => {
  it('never offers meat, dairy or anything past its date', () => {
    expect(canOffer(item('meat', 3), NOW)).toBe(false);
    expect(canOffer(item('dairy', 3), NOW)).toBe(false);
    expect(canOffer(item('produce', -1), NOW)).toBe(false);
    expect(canOffer(item('produce', 3), NOW)).toBe(true);
  });
  it('asks the taker to check the food, and never calls it safe', () => {
    const text = offerText(item('bakery', 2), NOW);
    expect(text).toMatch(/check it looks and smells fine/);
    expect(text).not.toMatch(/\bsafe\b/i);
  });
});
