import data from './rules/footprints.json';
import type { Category, ItemEvent } from './types';
import type { Unit } from './units';

/** Rough climate cost of some food: greenhouse gases (kg CO2e) and freshwater (litres). */
export interface Footprint { co2Kg: number; waterL: number; /** Events that could be counted. */ counted: number; /** Events left out: unknown amount or food type. */ skipped: number }

export const FOOTPRINT_SOURCE = data.source;
/** US EPA: a typical passenger car emits about 400 g CO2 per mile, about 0.25 kg per km. */
export const CAR_KG_PER_KM = 0.4 / 1.609;

const byName = data.byName.map((r) => ({ re: new RegExp(`\\b(${r.match})`, 'i'), co2: r.co2, water: r.water }));
const byCategory = data.byCategory as Partial<Record<Category, { co2: number; water: number }>>;
const pieces = data.pieceKg.map((r) => ({ re: new RegExp(`\\b(${r.match})`, 'i'), kg: r.kg }));

/** Footprint per kg for a food, by name first, then category. Null when the food type isn't covered. */
export function factorFor(name: string, category: Category): { co2: number; water: number } | null {
  return byName.find((r) => r.re.test(name)) ?? byCategory[category] ?? null;
}

/** Kilograms of an amount, or null when it can't be told (pieces of an unlisted food, no amount saved). */
export function kgOf(name: string, amount: number | undefined, unit: Unit | undefined): number | null {
  if (amount === undefined || !unit || !(amount > 0)) return null;
  switch (unit) {
    case 'kg': case 'l': return amount;
    case 'g': case 'ml': return amount / 1000;
    case 'pcs': { const p = pieces.find((r) => r.re.test(name)); return p ? amount * p.kg : null; }
  }
}

/** Adds up the footprint of history entries. Anything that can't be estimated is skipped, never guessed. */
export function footprintOf(events: Pick<ItemEvent, 'name' | 'category' | 'amount' | 'unit'>[]): Footprint {
  const out: Footprint = { co2Kg: 0, waterL: 0, counted: 0, skipped: 0 };
  for (const e of events) {
    const f = factorFor(e.name, e.category);
    const kg = kgOf(e.name, e.amount, e.unit);
    if (!f || kg === null) { out.skipped++; continue; }
    out.co2Kg += kg * f.co2;
    out.waterL += kg * f.water;
    out.counted++;
  }
  return out;
}

/** "3.2 kg", "850 g": small amounts read better in grams. */
export function formatCo2(kg: number): string {
  if (kg < 1) return `${Math.round(kg * 1000)} g`;
  return `${kg < 10 ? kg.toFixed(1) : Math.round(kg)} kg`;
}

export function formatWater(l: number): string {
  if (l >= 1000) return `${(l / 1000).toFixed(l < 10_000 ? 1 : 0)} m³`;
  return `${Math.round(l)} L`;
}
