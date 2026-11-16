import { describe, expect, it } from 'vitest';
import { AiError } from '../src/gemini.js';
import { createProductService } from '../src/products.js';
import { createReceiptScanner, ScanError } from '../src/receipts.js';
import { createRecipeService } from '../src/recipes.js';
import type { ProductInfo } from '../src/schemas.js';
import { MemoryStore } from '../src/store.js';
import { fakeGemini, fakeMealDb, fakeOcr, meal } from './fakes.js';

const info = (name: string, over: Partial<ProductInfo> = {}): ProductInfo => ({
  name, category: 'produce', homeZone: 'fridge', shelfLifeDays: { pantry: 2, fridge: 7, freezer: 120 },
  highRisk: false, multiUse: false, tags: [], tip: '', ...over,
});

/** Gemini answering product lookups from a table; unknown names get a plain produce answer. */
const productAi = (table: Record<string, Partial<ProductInfo>>) =>
  fakeGemini((req) => {
    const names = JSON.parse(req.prompt.slice(req.prompt.indexOf('['))) as string[];
    return { products: names.map((n) => ({ input: n, ...info(n, table[n.toLowerCase()] ?? {}) })) };
  });

describe('product lookup', () => {
  it('asks Gemini once, then serves repeats from the cache', async () => {
    const store = new MemoryStore();
    const ai = productAi({});
    const svc = createProductService(store, ai);
    await svc.lookup(['Spinach', 'Garlic'], { useAi: true });
    const again = await svc.lookup(['spinach', 'GARLIC'], { useAi: true });
    expect(ai.calls).toHaveLength(1);
    expect(again.products.get('spinach')?.name).toBe('Spinach');
  });
  it('does not call Gemini when AI is off, and reports it', async () => {
    const ai = productAi({});
    const out = await createProductService(new MemoryStore(), ai).lookup(['Spinach'], { useAi: false });
    expect(ai.calls).toHaveLength(0);
    expect(out.ai).toBe('skipped');
    expect(out.products.get('spinach')).toBeNull();
  });
  it('applies safety floors to what Gemini returns', async () => {
    const ai = productAi({ chicken: { category: 'meat', highRisk: false, homeZone: 'pantry', shelfLifeDays: { pantry: 4, fridge: 2, freezer: 200 } } });
    const out = await createProductService(new MemoryStore(), ai).lookup(['Chicken'], { useAi: true });
    expect(out.products.get('chicken')).toMatchObject({ highRisk: true, homeZone: 'fridge', shelfLifeDays: { pantry: null } });
  });
  it('reports quota and failures without throwing', async () => {
    const down = fakeGemini(() => { throw new AiError('quota', 'spent'); });
    const out = await createProductService(new MemoryStore(), down).lookup(['Spinach'], { useAi: true });
    expect(out.ai).toBe('quota');
    expect(out.products.get('spinach')).toBeNull();
  });
  it('ignores entries for names it did not ask about', async () => {
    const ai = fakeGemini(() => ({ products: [{ input: 'Injected', ...info('Injected') }, { input: 'Spinach', ...info('Spinach') }] }));
    const store = new MemoryStore();
    await createProductService(store, ai).lookup(['Spinach'], { useAi: true });
    expect([...store.products.keys()]).toEqual(['spinach']);
  });
});

describe('receipt scanning', () => {
  const ocrLines = [
    { text: 'FRESHMART', confidence: 0.95 }, { text: 'CHKN BRST 7.99', confidence: 0.9 },
    { text: 'SUBTOTAL 7.99', confidence: 0.9 },
  ];
  const extraction = {
    store: 'FreshMart', date: null, subtotal: 7.99, tax: null, total: 7.99,
    currency: { code: null, symbol: '$', confidence: 0.5, evidence: ['only a $ sign'] },
    items: [{ sourceLine: 1, raw: 'CHKN BRST 7.99', name: 'Chicken breast', quantity: 1, unit: 'pcs', price: 7.99, category: 'meat', isFood: true, certainty: 0.9 }],
  };
  const input = { image: Buffer.from('x'), filename: 'r.jpg', contentType: 'image/jpeg', useAi: true };

  it('structures OCR text with Gemini and blends OCR confidence into each line', async () => {
    const ai = fakeGemini(() => extraction);
    const r = await createReceiptScanner(fakeOcr(ocrLines), ai).scan(input);
    expect(r.source).toBe('gemini');
    expect(r.lines[0]).toMatchObject({ name: 'Chicken breast', price: 7.99, confidence: 0.9 });
    expect(ai.calls[0]?.prompt).toContain('[1] CHKN BRST 7.99');
  });
  it('falls back to basic rules, with a warning, when the AI budget is spent', async () => {
    const down = fakeGemini(() => { throw new AiError('quota', 'spent'); });
    const r = await createReceiptScanner(fakeOcr(ocrLines), down).scan(input);
    expect(r.source).toBe('rules');
    expect(r.warnings.join(' ')).toMatch(/budget/);
    expect(r.lines[0]?.name).toBe('CHKN BRST');
    expect(r.lines[0]?.confidence).toBeLessThan(0.6);
  });
  it('warns about blurry photos', async () => {
    const blurry = ocrLines.map((l) => ({ ...l, confidence: 0.3 }));
    const r = await createReceiptScanner(fakeOcr(blurry), fakeGemini(() => extraction)).scan(input);
    expect(r.warnings.join(' ')).toMatch(/hard to read/);
  });
  it('errors clearly when there is no text or the OCR service is down', async () => {
    const s = (ocr: ReturnType<typeof fakeOcr>) => createReceiptScanner(ocr, fakeGemini(() => extraction)).scan(input);
    await expect(s(fakeOcr([]))).rejects.toMatchObject({ code: 'no_text', status: 422 });
    await expect(s(fakeOcr([], { fail: 'unreachable' }))).rejects.toBeInstanceOf(ScanError);
    await expect(s(fakeOcr([], { fail: 'bad_image' }))).rejects.toMatchObject({ status: 415 });
  });
});

describe('recipe suggestions', () => {
  const meals = [
    meal('1', 'Garlic Chicken', ['Chicken', 'Garlic', 'Salt']),
    meal('2', 'Spinach Eggs', ['Spinach', 'Eggs', 'Butter']),
    meal('3', 'Bacon Spinach', ['Bacon', 'Spinach']),
    meal('4', 'Peanut Chicken', ['Chicken', 'Peanut Butter']),
  ];
  const db = fakeMealDb(meals, { Chicken: ['1', '4'], Spinach: ['2', '3'] });
  const items = [
    { id: 'a', name: 'Chicken breast', urgency: 3 }, { id: 'b', name: 'Spinach', urgency: 4 },
    { id: 'c', name: 'Garlic', urgency: 1 }, { id: 'd', name: 'Butter', urgency: 1 },
  ];
  const svc = (ai = productAi({})) => createRecipeService(db, createProductService(new MemoryStore(), ai));

  it('matches strictly: "Chicken breast" is not "Chicken", so it finds no chicken recipes', async () => {
    const out = await svc().suggest({ items: [{ id: 'a', name: 'Chicken breast', urgency: 3 }, ...items.slice(2)], diets: [], limit: 6, useAi: true });
    expect(out.meta.unmatchedSeeds).toEqual(['Chicken breast']);
    expect(out.recipes).toEqual([]);
  });
  it('queries every TheMealDB variant of an ingredient', async () => {
    const asked: string[] = [];
    const spy = { ...fakeMealDb(meals, { Tomatoes: ['1'], 'Chopped Tomatoes': ['2'] }, ['Tomatoes', 'Chopped Tomatoes', 'Chicken', 'Garlic', 'Spinach', 'Eggs', 'Butter']),
      async byIngredient(n: string) { asked.push(n); return fakeMealDb(meals, { Tomatoes: ['1'], 'Chopped Tomatoes': ['2'] }).byIngredient(n); } };
    await createRecipeService(spy, createProductService(new MemoryStore(), productAi({}))).suggest({ items: [{ id: 't', name: 'Tomatoes', urgency: 3 }], diets: [], limit: 3, useAi: true });
    expect(asked.sort()).toEqual(['Chopped Tomatoes', 'Tomatoes']);
  });
  it('ranks by urgent food, counts staples as available, and lists what to buy', async () => {
    const out = await svc().suggest({ items: [{ id: 'z', name: 'Chicken', urgency: 3 }, ...items.slice(1)], diets: [], limit: 6, useAi: true });
    const garlic = out.recipes.find((r) => r.id === '1')!;
    expect(garlic.missing).toEqual([]);
    expect(garlic.ingredients.find((i) => i.name === 'Salt')).toMatchObject({ staple: true, inStock: true });
    expect(garlic.rescuesItemIds).toEqual(['z']);
    const peanut = out.recipes.find((r) => r.id === '4')!;
    expect(peanut.missing).toEqual(['Peanut Butter']);
    expect(out.recipes[0]!.score).toBeGreaterThanOrEqual(out.recipes.at(-1)!.score);
  });
  it('says so when nothing is close to turning', async () => {
    const out = await svc().suggest({ items: items.map((i) => ({ ...i, urgency: 1 })), diets: [], limit: 3, useAi: true });
    expect(out.recipes).toEqual([]);
    expect(out.warnings[0]).toMatch(/nothing is close/i);
  });
  it('filters by diet using Gemini ingredient tags', async () => {
    const ai = productAi({ bacon: { category: 'meat', tags: ['pork', 'meat'], highRisk: true }, eggs: { tags: ['egg'] }, butter: { tags: ['dairy'] } });
    const vegan = await svc(ai).suggest({ items, diets: ['vegan'], limit: 6, useAi: true });
    expect(vegan.recipes.map((r) => r.id)).toEqual([]);
    const halal = await svc(ai).suggest({ items, diets: ['halal'], limit: 6, useAi: true });
    expect(halal.recipes.map((r) => r.id).sort()).toEqual(['2']);
  });
  it('fails closed: with AI unavailable, diet-filtered recipes are hidden, not guessed', async () => {
    const off = fakeGemini(() => ({}), false);
    const out = await svc(off).suggest({ items, diets: ['nut-free'], limit: 6, useAi: true });
    expect(out.recipes).toEqual([]);
    expect(out.warnings.join(' ')).toMatch(/hidden/);
  });
  it('pages through one stable ranking: no repeats, nothing skipped, the same page twice is identical', async () => {
    const many = Array.from({ length: 25 }, (_, i) => meal(`m${i}`, `Spinach dish ${i}`, ['Spinach', i % 2 ? 'Garlic' : 'Butter']));
    const big = createRecipeService(fakeMealDb(many, { Spinach: many.map((m) => m.id) }), createProductService(new MemoryStore(), productAi({})));
    const ask = (page: number) => big.suggest({ items, diets: [], limit: 10, page, useAi: true });
    const [p1, p2, p3, again] = await Promise.all([ask(1), ask(2), ask(3), ask(2)]);
    expect(p1.page).toEqual({ number: 1, size: 10, total: 25, pages: 3 });
    expect([p1, p2, p3].map((p) => p.recipes.length)).toEqual([10, 10, 5]);
    const ids = [p1, p2, p3].flatMap((p) => p.recipes.map((r) => r.id));
    expect(new Set(ids).size).toBe(25);
    expect(again.recipes.map((r) => r.id)).toEqual(p2.recipes.map((r) => r.id));
  });
  it('a new seed ("Find again") brings up different recipes, and each seed pages stably', async () => {
    const many = Array.from({ length: 25 }, (_, i) => meal(`m${i}`, `Spinach dish ${i}`, ['Spinach', i % 2 ? 'Garlic' : 'Butter']));
    const big = createRecipeService(fakeMealDb(many, { Spinach: many.map((m) => m.id) }), createProductService(new MemoryStore(), productAi({})));
    const ask = (seed: number, page = 1) => big.suggest({ items, diets: [], limit: 10, page, seed, useAi: true });
    const first = (await ask(0)).recipes.map((r) => r.id);
    const again = (await ask(7)).recipes.map((r) => r.id);
    expect(again).not.toEqual(first);
    expect((await ask(7)).recipes.map((r) => r.id)).toEqual(again);
    const all = [1, 2, 3].map(async (p) => (await ask(7, p)).recipes.map((r) => r.id));
    expect(new Set((await Promise.all(all)).flat()).size).toBe(25);
  });
  it('"Find again" puts recipes already seen last: page 1 is all new while unseen ones remain', async () => {
    const many = Array.from({ length: 25 }, (_, i) => meal(`m${i}`, `Spinach dish ${i}`, ['Spinach', i % 2 ? 'Garlic' : 'Butter']));
    const big = createRecipeService(fakeMealDb(many, { Spinach: many.map((m) => m.id) }), createProductService(new MemoryStore(), productAi({})));
    const first = await big.suggest({ items, diets: [], limit: 10, useAi: true });
    const seen = first.recipes.map((r) => r.id);
    const again = await big.suggest({ items, diets: [], limit: 10, seed: 3, seen, useAi: true });
    expect(again.recipes.every((r) => !seen.includes(r.id))).toBe(true);
    expect(again.page.total).toBe(25);
    const last = await big.suggest({ items, diets: [], limit: 10, page: 3, seed: 3, seen, useAi: true });
    expect(last.recipes.map((r) => r.id).every((id) => seen.includes(id))).toBe(true);
  });
  it('a seed never lets a recipe that rescues nothing in, nor outranks a much better rescue', async () => {
    const out = await svc().suggest({ items: [{ id: 'z', name: 'Chicken', urgency: 4 }, { id: 'b', name: 'Spinach', urgency: 2 }, ...items.slice(2)], diets: [], limit: 6, seed: 99, useAi: true });
    expect(out.recipes.every((r) => r.rescuesItemIds.length > 0)).toBe(true);
    expect(out.recipes[0]!.rescuesItemIds).toContain('z');
  });
  it('a page past the end is empty but still reports the real page count', async () => {
    const out = await svc().suggest({ items, diets: [], limit: 10, page: 4, useAi: true });
    expect(out.recipes).toEqual([]);
    expect(out.page.pages).toBe(1);
  });
  it('without diets, AI is not needed at all', async () => {
    const off = fakeGemini(() => ({}), false);
    const out = await svc(off).suggest({ items, diets: [], limit: 3, useAi: false });
    expect(out.recipes.length).toBeGreaterThan(0);
  });
});
