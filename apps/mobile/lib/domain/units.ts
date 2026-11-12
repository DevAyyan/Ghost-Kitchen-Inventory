/** How an item is measured: counted pieces, or a weight / volume. */
export type Unit = 'pcs' | 'kg' | 'g' | 'l' | 'ml';

export const UNITS: Unit[] = ['pcs', 'kg', 'g', 'l', 'ml'];

export const UNIT_LABEL: Record<Unit, string> = { pcs: 'pcs', kg: 'kg', g: 'g', l: 'L', ml: 'ml' };
const UNIT_NAME: Record<Unit, string> = { pcs: 'pieces', kg: 'kilograms', g: 'grams', l: 'litres', ml: 'millilitres' };

export const isUnit = (u: unknown): u is Unit => typeof u === 'string' && (UNITS as string[]).includes(u);
export const isCounted = (u: Unit) => u === 'pcs';

/** Trims float noise: 0.30000000004 -> "0.3", 2 -> "2". */
export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

/** "3 pcs", "0.5 kg", "250 g", "1 L". */
export function formatQty(amount: number, unit: Unit): string {
  if (unit === 'pcs') return `${formatAmount(amount)} ${amount === 1 ? 'pc' : 'pcs'}`;
  return `${formatAmount(amount)} ${UNIT_LABEL[unit]}`;
}

/** Screen-reader form: "3 pieces", "0.5 kilograms". */
export const spokenQty = (amount: number, unit: Unit) => `${formatAmount(amount)} ${UNIT_NAME[unit]}`;

/**
 * Snap positions for the "how much did you use" slider, as amounts in the item's unit, from 0 up to
 * `remaining`, always including both ends.
 * - Counted items snap to whole pieces (or larger steps when there are many).
 * - Weights and volumes snap to a round step: 100 g of 1 kg, 50 ml of 500 ml, 0.25 L of 2 L, and so on.
 */
export function snapPoints(remaining: number, unit: Unit): number[] {
  if (remaining <= 0) return [0];
  let step: number;
  if (unit === 'pcs') {
    step = remaining <= 24 ? 1 : niceStep(remaining / 12);
  } else {
    step = niceStep(remaining / 10);
  }
  const points: number[] = [];
  for (let v = 0; v < remaining - step / 1000; v += step) points.push(round(v));
  points.push(round(remaining));
  // A fractional remainder (e.g. 2.5 eggs left after a half) still gets its own end point above.
  return [...new Set(points)];
}

/** Closest snap point to `value`. */
export function snapTo(points: number[], value: number): number {
  return points.reduce((best, p) => (Math.abs(p - value) < Math.abs(best - value) ? p : best), points[0] ?? 0);
}

/** 1, 2 or 5 times a power of ten, at least `raw`: 0.083 -> 0.1, 37 -> 50. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return round(m * pow);
}

const round = (v: number) => Math.round(v * 1e6) / 1e6;
