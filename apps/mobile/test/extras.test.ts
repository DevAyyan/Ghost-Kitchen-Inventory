import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/domain/dates';
import { makeItem } from '@/lib/domain/expiry';
import { nightLevel } from '@/lib/domain/kitchen-scene';
import { rescuePlan } from '@/lib/domain/rescue-plan';
import { canOffer, offerText } from '@/lib/domain/surplus';
import { TOUR, tourAdvance, tourBack, tourNext } from '@/lib/domain/tour';
import type { Item } from '@/lib/domain/types';

const NOW = '2026-11-17';
const item = (id: string, left: number, over: Partial<Item> = {}): Item => {
  const it = makeItem({ name: id, category: 'vegetable', priceMinor: 200, currency: 'GBP', purchased: addDays(NOW, -4), qty: 1, unit: 'pcs' });
  return { ...it, id, name: id, expires: addDays(NOW, left), shelfDays: 4 + left, ...over };
};

describe('guided tour', () => {
  const review = TOUR.findIndex((s) => s.route === '/review');
  const scan = review - 1;
  it('moves on when the user does what a stop asks', () => {
    expect(tourAdvance(scan, '/review')).toBe(review);
    expect(tourAdvance(review, '/')).toBe(review + 1);
    expect(tourAdvance(scan, '/ledger')).toBeNull();
    expect(tourAdvance(0, '/scan')).toBeNull(); // the first stop has nothing to do
  });
  it('skips the review stop without a scanned receipt, both ways', () => {
    expect(tourNext(scan, false)).toBe(review + 1);
    expect(tourNext(scan, true)).toBe(review);
    expect(tourBack(review + 1)).toBe(scan);
    expect(tourNext(TOUR.length - 1, false)).toBeNull();
  });
  it('says the food-safety note on its last stop', () => {
    expect(TOUR.at(-1)!.body).toMatch(/always check the food itself/i);
    expect(TOUR.map((s) => s.body).join(' ')).not.toMatch(/\bsafe to eat\b/i);
  });
});

describe('3-day rescue plan', () => {
  const recipe = (id: string, itemIds: string[], missing = 0) =>
    ({ id, title: id, ingredients: itemIds.map((itemId) => ({ itemId })), missing: Array.from({ length: missing }, (_, n) => `m${n}`) });
  const fridge = [item('spinach', 1), item('milk', 2), item('carrot', 10), item('pepper', 0)];

  it('covers the most turning food between the meals, without repeats', () => {
    const plan = rescuePlan([recipe('a', ['spinach', 'milk']), recipe('b', ['spinach']), recipe('c', ['pepper', 'carrot'])], fridge, NOW);
    expect(plan.map((p) => p.recipe.id).sort()).toEqual(['a', 'c']);
    expect(plan.flatMap((p) => p.covers.map((i) => i.id)).sort()).toEqual(['milk', 'pepper', 'spinach']);
  });
  it('cooks the meal whose food goes off first, first, on consecutive days', () => {
    const plan = rescuePlan([recipe('a', ['milk']), recipe('c', ['pepper'])], fridge, NOW);
    expect(plan.map((p) => [p.date, p.recipe.id])).toEqual([[NOW, 'c'], [addDays(NOW, 1), 'a']]);
  });
  it('breaks ties on fewer missing ingredients, and plans nothing for fresh food only', () => {
    expect(rescuePlan([recipe('lots', ['spinach'], 4), recipe('few', ['spinach'], 1)], fridge, NOW, 1)[0]!.recipe.id).toBe('few');
    expect(rescuePlan([recipe('a', ['carrot'])], fridge, NOW)).toEqual([]);
  });
});

describe('offering surplus food', () => {
  it('only offers low-risk food that has not passed its date', () => {
    expect(canOffer(item('apples', 3), NOW)).toBe(true);
    expect(canOffer(item('apples', -1), NOW)).toBe(false);
    expect(canOffer(item('milk', 5, { category: 'dairy', highRisk: true }), NOW)).toBe(false);
    expect(canOffer(item('soup', 2, { category: 'leftovers' }), NOW)).toBe(false);
    expect(canOffer(item('apples', 3, { status: 'used' }), NOW)).toBe(false);
  });
  it('states the date honestly and asks the taker to check the food', () => {
    const est = offerText(item('Apples', 3, { expiryConfirmed: false }), NOW);
    expect(est).toMatch(/roughly good until/);
    expect(est).toMatch(/check it looks and smells fine/);
    expect(est).not.toMatch(/\bsafe\b/i);
    expect(offerText(item('Apples', 3, { expiryConfirmed: true, fraction: 0.5 }), NOW)).toMatch(/best by .*\(opened\)|\(opened\), best by/);
  });
});

describe('night in the kitchen', () => {
  it('steps from day to dusk to night', () => {
    expect([12, 18, 19, 21, 22, 2, 5, 6, 7].map(nightLevel)).toEqual([0, 0, 0.5, 0.5, 1, 1, 0.5, 0.5, 0]);
  });
});
