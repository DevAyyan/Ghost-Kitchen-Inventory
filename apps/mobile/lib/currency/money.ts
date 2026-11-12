import type { Money } from '@/lib/domain/types';
import { AMBIGUOUS_SYMBOLS, currencyInfo, isKnownCurrency } from './catalog';

/** Exchange rates: units of each currency per 1 unit of the snapshot's base (from GET /v1/rates). */
export type Rates = Record<string, number>;

/** Formats integer minor units, e.g. formatMoney(129900, 'PKR') -> "Rs 129,900". */
export function formatMoney(minor: number, currency: string): string {
  const { symbol, digits } = currencyInfo(currency);
  const neg = minor < 0;
  const [whole, frac] = (Math.abs(minor) / 10 ** digits).toFixed(digits).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sep = /^[A-Za-z]+$/.test(symbol) ? ' ' : ''; // "Rs 900", "$9.00"
  return `${neg ? '−' : ''}${symbol}${sep}${grouped}${frac ? `.${frac}` : ''}`;
}

export const toMinor = (major: number, currency: string) =>
  Math.round(major * 10 ** currencyInfo(currency).digits);

export const toMajor = (minor: number, currency: string) => minor / 10 ** currencyInfo(currency).digits;

/** What the extractor (Gemini or Tesseract rules) reports about the receipt currency. */
export interface DetectedCurrency {
  code?: string;
  symbol?: string;
  confidence: number;
  evidence: string[];
}

export interface ResolvedCurrency {
  code: string;
  confidence: number;
  source: 'detected' | 'default';
  evidence: string[];
  candidates?: string[];
}

/** SDS 3.2: trusted code -> ambiguous symbol (store hint, then default as tie-break) -> default. */
export function resolveCurrency(det: DetectedCurrency, defaultCode: string, storeHint?: string): ResolvedCurrency {
  if (det.code && det.confidence >= 0.8 && isKnownCurrency(det.code)) {
    return { code: det.code, confidence: det.confidence, source: 'detected', evidence: det.evidence };
  }
  const candidates = det.symbol ? AMBIGUOUS_SYMBOLS[det.symbol] : undefined;
  if (candidates) {
    const hinted = storeHint && candidates.includes(storeHint);
    const code = hinted ? storeHint : candidates.includes(defaultCode) ? defaultCode : candidates[0];
    const evidence = [...det.evidence];
    if (hinted) evidence.push(`you picked ${code} for this store before`);
    else if (code === defaultCode) evidence.push('matches your default currency');
    return {
      code, candidates, source: 'detected', evidence,
      confidence: Math.min(det.confidence, hinted ? 0.75 : 0.6),
    };
  }
  return { code: defaultCode, confidence: 0.3, source: 'default', evidence: ['no currency found on the receipt'] };
}

export function sumByCurrency(entries: Money[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) if (e.minor) out[e.currency] = (out[e.currency] ?? 0) + e.minor;
  return out;
}

/** Converts a multi-currency sum; null when there are no rates or any currency has no rate. */
export function convert(by: Record<string, number>, to: string, rates: Rates | null | undefined): number | null {
  if (!rates || !(to in rates)) return null;
  let major = 0;
  for (const [code, minor] of Object.entries(by)) {
    if (!(code in rates)) return null;
    major += (toMajor(minor, code) / rates[code]) * rates[to];
  }
  return toMinor(major, to);
}

export interface MoneySummary {
  text: string;
  /** Present when amounts were converted: e.g. "from $12.00 + €4.00". */
  detail?: string;
  converted: boolean;
  /** Minor units in the display currency, when a single total exists. */
  value: number | null;
  uncovered: string[];
}

/** Ledger presentation rule (SDS section 8). */
export function summarize(entries: Money[], display: string, rates?: Rates | null): MoneySummary {
  const by = sumByCurrency(entries);
  const codes = Object.keys(by);
  if (codes.length === 0) return { text: formatMoney(0, display), converted: false, value: 0, uncovered: [] };
  if (codes.length === 1 && codes[0] === display) {
    return { text: formatMoney(by[display], display), converted: false, value: by[display], uncovered: [] };
  }
  const parts = codes.map((c) => formatMoney(by[c], c)).join(' + ');
  const total = convert(by, display, rates);
  if (total !== null) return { text: formatMoney(total, display), detail: `from ${parts}`, converted: true, value: total, uncovered: [] };
  const uncovered = rates ? [...new Set([...codes, display].filter((c) => !(c in rates)))] : [];
  return { text: parts, converted: false, value: null, uncovered };
}
