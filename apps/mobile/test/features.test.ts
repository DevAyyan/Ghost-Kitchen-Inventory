import { describe, expect, it } from 'vitest';
import { budgetStatus, daysLeftInMonth, receiptsThisMonth } from '@/lib/domain/budget';
import { type DraftLine, blankLine } from '@/lib/domain/draft';
import { findDuplicates } from '@/lib/domain/dupes';
import { makeItem } from '@/lib/domain/expiry';
import { buildExport } from '@/lib/domain/export';
import type { Item } from '@/lib/domain/types';

const NOW = '2026-11-17';
const stocked = (name: string, over: Partial<Item> = {}): Item => ({ ...makeItem({ name, category: 'vegetable', priceMinor: 300, currency: 'USD', purchased: '2026-11-15' }), ...over });
const line = (name: string, over: Partial<DraftLine> = {}): DraftLine => ({ ...blankLine(NOW), name, ...over });

describe('duplicate warning on review', () => {
  it('matches the same food however it is written', () => {
    const l = line('Baby Spinach');
    const out = findDuplicates([l], [stocked('spinach')], NOW);
    expect(out.get(l.id)?.name).toBe('spinach');
  });
  it('ignores used, discarded and non-food rows, and different foods', () => {
    const a = line('spinach'), b = line('spinach', { include: false }), c = line('spinach', { nonFood: true }), d = line('carrots');
    const items = [stocked('spinach', { status: 'used' }), stocked('spinach', { status: 'discarded' })];
    expect(findDuplicates([a, b, c, d], items, NOW).size).toBe(0);
    expect(findDuplicates([a, b, c, d], [stocked('spinach')], NOW).has(d.id)).toBe(false);
  });
  it('names the one that goes off first, and states how long is left without calling it safe', () => {
    const l = line('milk');
    const out = findDuplicates([l], [stocked('milk', { expires: '2026-11-25' }), stocked('milk', { expires: '2026-11-18' })], NOW);
    expect(out.get(l.id)?.remaining).toBe('1 day left');
  });
  it('reports a past date plainly', () => {
    const l = line('milk');
    expect(findDuplicates([l], [stocked('milk', { expires: '2026-11-15' })], NOW).get(l.id)?.remaining).toBe('Expired 2 days ago');
  });
});

describe('monthly budget', () => {
  it('counts only receipts from this calendar month', () => {
    const r = (date: string) => ({ id: date, store: 's', date, currency: 'USD', totalMinor: 100 });
    expect(receiptsThisMonth([r('2026-11-01'), r('2026-10-31'), r('2026-11-30'), r('2025-11-10')], NOW).map((x) => x.date)).toEqual(['2026-11-01', '2026-11-30']);
  });
  it('counts days left including today, across month lengths', () => {
    expect(daysLeftInMonth('2026-11-17')).toBe(14);
    expect(daysLeftInMonth('2028-02-28')).toBe(2);
    expect(daysLeftInMonth('2026-12-31')).toBe(1);
  });
  it('reports under, over, and no budget', () => {
    expect(budgetStatus(30_000, 40_000, NOW)).toMatchObject({ over: false, leftMinor: 10_000, used: 0.75 });
    expect(budgetStatus(45_000, 40_000, NOW)).toMatchObject({ over: true, leftMinor: -5_000 });
    expect(budgetStatus(10, 0, NOW)).toBeNull();
    expect(budgetStatus(null, 40_000, NOW)).toBeNull();
  });
});

describe('data export', () => {
  const base = { receipts: [], events: [], shopping: [], plan: [], exportedAt: '2026-11-17T10:00:00Z', appVersion: '0.1.0' };
  it('never writes the server token or address', () => {
    const json = buildExport({ ...base, items: [], settings: { displayCurrency: 'USD', apiToken: 'SECRET-TOKEN', apiUrl: 'https://kitchen.example.com' } });
    expect(json).not.toContain('SECRET-TOKEN');
    expect(json).not.toContain('kitchen.example.com');
    expect(JSON.parse(json).settings).toHaveProperty('displayCurrency');
  });
  it('leaves photos out but says an item had one, and keeps estimate flags', () => {
    const it = stocked('spinach', { photoUri: 'data:image/jpeg;base64,AAAA' });
    const json = buildExport({ ...base, items: [it], settings: {} });
    expect(json).not.toContain('AAAA');
    const out = JSON.parse(json);
    expect(out.items[0]).toMatchObject({ name: 'spinach', hadPhoto: true, expiryConfirmed: false });
    expect(out.note).toMatch(/check the package/i);
  });
});

import { factorFor, footprintOf, formatCo2, kgOf } from '@/lib/domain/impact';

describe('climate footprint', () => {
  it('picks the food by name before its category, without false matches', () => {
    expect(factorFor('Ground beef', 'meat')!.co2).toBeCloseTo(99.48);
    expect(factorFor('Salmon steak', 'fish')!.co2).toBeCloseTo(13.63);
    expect(factorFor('Eggplant', 'vegetable')!.co2).toBeCloseTo(0.43);
    expect(factorFor('Pear', 'fruit')!.co2).toBeCloseTo(0.39);
    expect(factorFor('Mystery meat', 'meat')!.co2).toBeCloseTo(9.87);
    expect(factorFor('Lasagne', 'leftovers')).toBeNull();
  });
  it('converts amounts, and only counts pieces of foods with a known weight', () => {
    expect(kgOf('Milk', 500, 'ml')).toBe(0.5);
    expect(kgOf('Eggs', 6, 'pcs')).toBeCloseTo(0.36);
    expect(kgOf('Jackfruit', 1, 'pcs')).toBeNull();
    expect(kgOf('Rice', undefined, undefined)).toBeNull();
  });
  it('skips what it cannot estimate instead of guessing', () => {
    const f = footprintOf([
      { name: 'Cheddar', category: 'dairy', amount: 200, unit: 'g' },
      { name: 'Soup', category: 'leftovers', amount: 1, unit: 'l' },
      { name: 'Rice', category: 'dry' },
    ]);
    expect(f.counted).toBe(1);
    expect(f.skipped).toBe(2);
    expect(f.co2Kg).toBeCloseTo(4.776);
    expect(formatCo2(f.co2Kg)).toBe('4.8 kg');
    expect(formatCo2(0.25)).toBe('250 g');
  });
});

import { weekStory, type WeekSummary } from '@/lib/domain/weekly';

describe('weekly ghost story', () => {
  const week = (over: Partial<WeekSummary> = {}): WeekSummary => ({
    start: '2026-11-09', end: '2026-11-15', spent: [], rescued: [{ minor: 500, currency: 'GBP' }], rescuedCount: 3,
    wasted: [], wastedCount: 0, topWasted: [], previous: { rescued: [], wasted: [], wastedCount: 2 }, comingUp: [], tips: [], ...over,
  });
  const fmt = () => '£5.00';
  it('tells the week in counts and money, with the climate line when known', () => {
    const s = weekStory(week(), fmt, { co2SavedKg: 2.34 });
    expect(s).toMatch(/banished 3 ghosts/);
    expect(s).toMatch(/2\.3 kg of CO₂e/);
    expect(s).toMatch(/graveyard stayed empty/);
    expect(s).toMatch(/Fewer burials/);
  });
  it('never calls food safe, and names at most the most-binned item', () => {
    const s = weekStory(week({ wastedCount: 2, wasted: [{ minor: 300, currency: 'GBP' }], topWasted: [{ name: 'Lettuce', count: 2 }] }), fmt);
    expect(s).not.toMatch(/safe/i);
    expect(s).toMatch(/Lettuce among them/);
  });
});

import { rowNeedsCheck, sectionCounts } from '@/lib/domain/draft';
import { turningNote, turningStock } from '@/lib/domain/shopping';
import { householdBoard } from '@/lib/domain/weekly';
import type { ItemEvent } from '@/lib/domain/types';

describe('review: rows to check', () => {
  it('flags low confidence, blank names, duplicates and past dates only', () => {
    expect(rowNeedsCheck(line('Milk', { manual: false, confidence: 0.5 }), { duplicate: false, now: NOW })).toBe(true);
    expect(rowNeedsCheck(line(''), { duplicate: false, now: NOW })).toBe(true);
    expect(rowNeedsCheck(line('Milk'), { duplicate: true, now: NOW })).toBe(true);
    expect(rowNeedsCheck(line('Milk', { expires: '2026-11-10' }), { duplicate: false, now: NOW })).toBe(true);
    expect(rowNeedsCheck(line('Milk', { expires: '2026-11-25' }), { duplicate: false, now: NOW })).toBe(false);
    expect(rowNeedsCheck(line('Bag', { nonFood: true, confidence: 0.1 }), { duplicate: false, now: NOW })).toBe(false);
  });
  it('counts stocked rows per section', () => {
    expect(sectionCounts([line('Milk'), line('Peas', { zone: 'freezer' }), line('Bag', { nonFood: true })])).toEqual({ freezer: 1, fridge: 1, pantry: 0 });
  });
});

describe('shopping: use what is turning first', () => {
  it('points at turning stock, soonest first, and never at spoiled food', () => {
    const soon = stocked('Milk', { category: 'dairy', highRisk: true, purchased: '2026-11-10', expires: '2026-11-18', shelfDays: 8 });
    const later = stocked('Milk', { category: 'dairy', highRisk: true, purchased: '2026-11-10', expires: '2026-11-19', shelfDays: 9 });
    const spoiled = stocked('Milk', { category: 'dairy', highRisk: true, expires: '2026-11-15' });
    const fresh = stocked('Milk', { expires: '2026-12-30', shelfDays: 45 });
    expect(turningStock('milk', [later, spoiled, soon, fresh], NOW).map((i) => i.expires)).toEqual(['2026-11-18', '2026-11-19']);
    expect(turningNote('Milk', [soon], NOW)).toBe('Use yours first: Milk, 1 day left.');
    expect(turningNote('Milk', [spoiled, fresh], NOW)).toBeNull();
  });
});

describe('household board', () => {
  const ev = (by: string | undefined, type: 'used' | 'discarded', stage: ItemEvent['stage'], date = '2026-11-17'): ItemEvent =>
    ({ id: Math.random().toString(), type, name: 'x', category: 'vegetable', minor: 100, currency: 'GBP', stage, date, ...(by ? { by } : {}) });
  it('ranks by rescues, shows burials without penalty, and ignores other weeks and unknown people', () => {
    const rows = householdBoard([
      ev('a', 'used', 'expiring'), ev('a', 'discarded', 'spoiled'), ev('a', 'discarded', 'spoiled'),
      ev('b', 'used', 'expiring'), ev('b', 'used', 'rotting'), ev('b', 'used', 'fresh'),
      ev('c', 'used', 'expiring', '2026-11-01'), ev(undefined, 'used', 'expiring'),
    ], '2026-11-16');
    expect(rows).toEqual([{ by: 'b', rescued: 2, buried: 0 }, { by: 'a', rescued: 1, buried: 2 }]);
  });
});

import { countUpAt } from '@/lib/domain/count-up';
describe('count-up', () => {
  it('steps from 0 to 1 and stays there', () => {
    expect(countUpAt(0)).toBe(0);
    expect(countUpAt(350)).toBe(0.5);
    expect(countUpAt(10_000)).toBe(1);
  });
});
