import { describe, expect, it } from 'vitest';
import { demoReply, demoSuggest, demoTonight, DemoUnavailable } from '@/lib/demo/replay';
import { today } from '@/lib/domain/dates';

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const fridge = [
  { id: 'spin', name: 'Spinach', urgency: 3 },
  { id: 'egg', name: 'Eggs', urgency: 1 },
  { id: 'straw', name: 'Strawberries', urgency: 3 },
  { id: 'avo', name: 'Avocado', urgency: 4 },
];

describe('demo mode replay', () => {
  it('reads the sample receipt with today as its date, so nothing arrives already expired', async () => {
    const r = (await demoReply('/v1/receipts/scan', { method: 'POST' })) as { date: string; lines: unknown[]; currency: { code: string } };
    expect(r.date).toBe(today());
    expect(r.lines).toHaveLength(10);
    expect(r.currency.code).toBe('GBP');
  }, 10_000);

  it('answers only the products it knows; the rest fall back to the rough estimate', async () => {
    const r = (await demoReply('/v1/products/info', post({ names: ['Whole milk', 'Dragon fruit'], useAi: true }))) as { products: Record<string, unknown> };
    expect(r.products['Whole milk']).toMatchObject({ highRisk: true, shelfLifeDays: { pantry: null } });
    expect(r.products['Dragon fruit']).toBeNull();
  });

  it('ranks recorded recipes that use urgent food first, and only links food that was sent', () => {
    const res = demoSuggest({ items: fridge, diets: [], limit: 3, page: 1 });
    expect(res.recipes.length).toBe(3);
    expect(res.recipes[0]!.rescuesItemIds.length).toBeGreaterThan(0);
    const sent = new Set(fridge.map((i) => i.id));
    for (const r of res.recipes) for (const g of r.ingredients) if (g.itemId) expect(sent.has(g.itemId)).toBe(true);
    expect(res.warnings.join(' ')).toMatch(/demo mode/i);
  });

  it('pages through the same ranking', () => {
    const a = demoSuggest({ items: fridge, diets: [], limit: 2, page: 1 });
    const b = demoSuggest({ items: fridge, diets: [], limit: 2, page: 2 });
    expect(a.page.total).toBe(b.page.total);
    expect(a.recipes.map((r) => r.id)).not.toEqual(b.recipes.map((r) => r.id));
  });

  it('fails closed on diets: only recipes listed as fitting every chosen diet', () => {
    const vegan = demoSuggest({ items: fridge, diets: ['vegan'], limit: 20, page: 1 });
    expect(vegan.recipes.every((r) => ['53473', '52775'].includes(r.id))).toBe(true);
    expect(demoSuggest({ items: fridge, diets: ['vegan', 'gluten-free'], limit: 20, page: 1 }).recipes).toHaveLength(0);
  });

  it('suggests nothing from food it was not sent', () => {
    expect(demoSuggest({ items: [], diets: [], limit: 3, page: 1 }).recipes).toHaveLength(0);
  });

  it("tonight never uses high-risk food past its date", () => {
    const idea = demoTonight({ items: [{ name: 'Chicken breast', daysLeft: -1, highRisk: true }, { name: 'Spinach', daysLeft: 1, highRisk: false }], diets: [] });
    expect(idea.uses).not.toContain('Chicken breast');
    expect(idea.source).toBe('template');
  });

  it('converts rates from the recorded snapshot, and refuses what it can’t fake', async () => {
    const r = (await demoReply('/v1/rates?base=GBP', {})) as { base: string; rates: Record<string, number> };
    expect(r.base).toBe('GBP');
    expect(r.rates.GBP).toBeCloseTo(1);
    await expect(demoReply('/v1/households/sync', post({}))).rejects.toBeInstanceOf(DemoUnavailable);
  });
});
