import { describe, expect, it } from 'vitest';
import { cookAmount } from '@/lib/domain/cooking';
import { addDays, daysBetween, weekStart } from '@/lib/domain/dates';
import { parsePrice, parseQty } from '@/lib/domain/draft';
import { makeItem, stageOf } from '@/lib/domain/expiry';
import { doorSignals, isForgotten } from '@/lib/domain/haunt';
import { foodKey } from '@/lib/domain/learning';
import { planMove } from '@/lib/domain/storage';
import { suggestMove } from '@/lib/domain/suggest';
import type { Item } from '@/lib/domain/types';
import { snapPoints } from '@/lib/domain/units';
import { REGION, SCENE_ASPECT, SPRITE_W, zoomTarget } from '@/lib/domain/kitchen-scene';

const NOW = '2026-11-17';
const item = (over: Partial<Parameters<typeof makeItem>[0]> & { left?: number } = {}): Item => {
  const { left, ...input } = over;
  const it = makeItem({ name: 'Potatoes', category: 'produce', priceMinor: 400, currency: 'USD', purchased: addDays(NOW, -2), zone: 'pantry', qty: 2, unit: 'kg', ...input });
  return left === undefined ? it : { ...it, expires: addDays(NOW, left), shelfDays: Math.max(1, daysBetween(it.purchased, addDays(NOW, left))) };
};

describe('dates (local calendar days, across DST)', () => {
  it('counts whole days over the October clock change', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
  });
  it('crosses months and leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('weeks start on Monday', () => {
    expect(weekStart('2026-11-17')).toBe('2026-11-16');
    expect(weekStart('2026-11-22')).toBe('2026-11-16');
  });
});

describe('prices and amounts typed on the review screen', () => {
  it('empty is free; negatives and junk are not numbers', () => {
    expect(parsePrice('')).toBe(0);
    expect(parsePrice('2,49')).toBe(2.49);
    expect(Number.isNaN(parsePrice('1.2.3'))).toBe(true);
    expect(Number.isNaN(parsePrice('-3'))).toBe(true);
  });
  it('an amount must be positive', () => {
    expect(parseQty('0.5')).toBe(0.5);
    expect(Number.isNaN(parseQty('0'))).toBe(true);
  });
});

describe('slider snap points', () => {
  it('counts per piece, weights in round steps, always including what is left', () => {
    expect(snapPoints(12, 'pcs')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(snapPoints(1, 'kg')).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    expect(snapPoints(0.734, 'kg').at(-1)).toBe(0.734);
  });
});

describe('cooking uses what the recipe needs', () => {
  it('300 g of a 2 kg bag is 0.3 kg, not the whole bag', () => {
    expect(cookAmount(item(), { amount: 0.3, unit: 'kg' })).toEqual({ itemId: expect.any(String), amount: 0.3, basis: 'recipe' });
  });
  it('never more than what is left, and whole pieces for counted food', () => {
    const eggs = item({ name: 'Eggs', category: 'eggs', zone: 'fridge', qty: 6, unit: 'pcs' });
    expect(cookAmount(eggs, { amount: 9, unit: 'pcs' }).amount).toBe(6);
    expect(cookAmount(eggs, { amount: 1.4, unit: 'pcs' }).amount).toBe(1);
  });
  it('without a readable amount: half a multi-use pack, else all of it', () => {
    expect(cookAmount({ ...item(), multiUse: true }).amount).toBe(1);
    expect(cookAmount(item()).amount).toBe(2);
    expect(cookAmount(item(), { amount: 2, unit: 'pcs' }).basis).toBe('all');
  });
});

describe('moving food between sections (food-safety floors)', () => {
  it('high-risk food never goes in the pantry, even when its category table allows it', () => {
    const leftover = { ...item({ name: 'Curry', category: 'other', zone: 'fridge', left: 2 }), highRisk: true };
    expect(planMove(leftover, 'pantry', NOW).ok).toBe(false);
  });
  it('spoiled food cannot be moved, and rotting food cannot be frozen', () => {
    expect(planMove(item({ left: -5 }), 'fridge', NOW).ok).toBe(false);
    expect(planMove(item({ left: -1 }), 'freezer', NOW).ok).toBe(false);
  });
});

describe('move suggestions', () => {
  it('expiring, freezable food gets "freeze it to save it"', () => {
    const s = suggestMove(item({ name: 'Chicken breast', category: 'meat', zone: 'fridge', qty: 0.5, left: 1 }), NOW);
    expect(s).toMatchObject({ to: 'freezer', kind: 'save' });
  });
  it('fresh food in the wrong place gets "keeps longer in…"', () => {
    const tomatoes = item({ name: 'Bread', category: 'bakery', zone: 'pantry', left: 3 });
    const s = suggestMove({ ...tomatoes, life: { pantry: 3, fridge: 8, freezer: 90 } }, NOW);
    expect(s).toMatchObject({ to: 'fridge', kind: 'longer' });
  });
  it('never suggests anything for spoiled food, rotting food or the pantry for high-risk food', () => {
    expect(suggestMove(item({ left: -5 }), NOW)).toBeNull();
    expect(suggestMove(item({ left: -1 }), NOW)).toBeNull();
    const milk = item({ name: 'Milk', category: 'dairy', zone: 'fridge', unit: 'l', qty: 1, left: 6 });
    expect(suggestMove({ ...milk, life: { pantry: 30, fridge: 7, freezer: 60 } }, NOW)?.to).not.toBe('pantry');
  });
});

describe('learning: the same food however it was typed', () => {
  it('drops pack words and plurals but keeps different foods apart', () => {
    expect(foodKey('Baby Spinach ')).toBe('spinach');
    expect(foodKey('Fresh spinach')).toBe('spinach');
    expect(foodKey('Cherry Tomatoes')).toBe(foodKey('cherry tomato'));
    expect(foodKey('Sweet potatoes')).toBe('sweet potato');
    expect(foodKey('Sweet potatoes')).not.toBe(foodKey('Potatoes'));
  });
});

describe('door signals', () => {
  it('counts each stage and flags expiring, spoiled and forgotten food', () => {
    const rice = { ...item({ name: 'Rice', category: 'dry', purchased: addDays(NOW, -30), left: 300 }) };
    const s = doorSignals([item({ left: 1 }), item({ left: -9 }), rice], NOW);
    expect(s.counts).toMatchObject({ expiring: 1, spoiled: 1, fresh: 1 });
    expect(s).toMatchObject({ expiring: true, spoiled: true, forgotten: 1, total: 3 });
    expect(isForgotten(rice, stageOf(rice, NOW), NOW)).toBe(true);
  });
});

describe('kitchen scene zoom', () => {
  const zones = ['freezer', 'fridge', 'pantry'] as const;

  it('centres the zone on the window when fully zoomed', () => {
    for (const zone of zones) {
      const w = 640, h = w / SCENE_ASPECT, win = { w: 390, h: 844 };
      const { scale, fx, fy } = zoomTarget(zone, w, h, win.w, win.h);
      // Box centre sits at (100, 200) in the window; the camera shifts by tx, ty.
      const tx = win.w / 2 - 100 - scale * fx, ty = win.h / 2 - 200 - scale * fy;
      expect(100 + scale * fx + tx).toBeCloseTo(win.w / 2);
      expect(200 + scale * fy + ty).toBeCloseTo(win.h / 2);
    }
  });

  it('fits each zone inside the window and fills it along one axis', () => {
    for (const zone of zones) for (const win of [{ w: 390, h: 844 }, { w: 1280, h: 800 }]) {
      const w = 640, { scale } = zoomTarget(zone, w, w / SCENE_ASPECT, win.w, win.h);
      const u = (w / (SPRITE_W * 2)) * scale;
      const wide = REGION[zone].w * u / win.w, tall = REGION[zone].h * u / win.h;
      expect(Math.max(wide, tall)).toBeCloseTo(0.96);
    }
  });
});
