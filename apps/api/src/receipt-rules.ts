import type { OcrLine } from './ocr.js';
import type { Category, Unit } from './schemas.js';

export interface RuleItem {
  sourceLine: number; raw: string; name: string; quantity: number; unit: Unit; price: number;
  category: Category; isFood: boolean; certainty: number;
}
export interface RuleResult {
  store: string | null;
  date: string | null;
  currency: { code: string | null; symbol: string | null; confidence: number; evidence: string[] };
  subtotal: number | null; tax: number | null; total: number | null;
  items: RuleItem[];
}

const ISO_CODES = [
  'USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'CNY', 'SGD', 'HKD',
  'MYR', 'THB', 'ZAR', 'BRL', 'MXN', 'TRY', 'SEK', 'NOK', 'DKK', 'PLN', 'BDT', 'LKR', 'NGN', 'KES', 'EGP',
];
const UNIQUE_SYMBOLS: [string, string][] = [['€', 'EUR'], ['£', 'GBP'], ['₹', 'INR'], ['₺', 'TRY'], ['₩', 'KRW'], ['₦', 'NGN'], ['฿', 'THB']];
const AMBIGUOUS_SYMBOLS = ['$', 'Rs', '₨', '¥', 'kr'];
const ZERO_DECIMAL = new Set(['PKR', 'JPY', 'KRW', 'VND', 'IDR']);

/** Lines that are never products. */
const NOT_ITEM = /\b(sub\s*-?\s*total|total|tax|vat|gst|mwst|change|cash|card|visa|mastercard|debit|credit|balance|amount|tender|thank|receipt|invoice|tel|phone|cashier|saving|discount|rounding|points|auth|approved|date|time)\b|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/i;

export function detectCurrency(text: string): RuleResult['currency'] {
  const evidence: string[] = [];
  // A code only counts next to an amount ("PKR 2,705", "32.35 USD"). Otherwise product abbreviations
  // such as "GRK YOG PLN 32z" (plain yogurt) would read as Polish zloty.
  for (const code of ISO_CODES) {
    const near = new RegExp(`\\b${code}\\.?\\s?\\d[\\d.,]*(?![\\w])|\\d[\\d.,]*\\s?${code}\\b`);
    if (near.test(text)) return { code, symbol: null, confidence: 0.9, evidence: [`"${code}" printed next to an amount`] };
  }
  for (const [sym, code] of UNIQUE_SYMBOLS) {
    if (text.includes(sym)) return { code, symbol: sym, confidence: 0.85, evidence: [`"${sym}" symbol`] };
  }
  for (const sym of AMBIGUOUS_SYMBOLS) {
    const re = sym.length > 1 ? new RegExp(`\\b${sym}\\.?\\s?\\d`) : new RegExp(`\\${sym}\\s?\\d`);
    if (re.test(text)) { evidence.push(`only a "${sym}" symbol`); return { code: null, symbol: sym === '₨' ? 'Rs' : sym, confidence: 0.5, evidence }; }
  }
  return { code: null, symbol: null, confidence: 0, evidence: [] };
}

function parseAmount(raw: string): number {
  // "1.234,56" and "1,234.56" both -> 1234.56; a lone comma before 2 digits is a decimal comma.
  const s = raw.replace(/\s/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const sep = Math.max(lastDot, lastComma);
  if (sep === -1) return Number(s);
  const decimals = s.length - sep - 1;
  const intPart = s.slice(0, sep).replace(/[.,]/g, '');
  return decimals === 3 && !(lastDot !== -1 && lastComma !== -1) ? Number(s.replace(/[.,]/g, '')) : Number(`${intPart}.${s.slice(sep + 1)}`);
}

/**
 * Amount printed on a receipt line: "1KG", "250 G", "1LTR", "500ML", "12PC", "2@1.25" (2 pieces).
 * Returns pieces = 1 when nothing is printed.
 */
export function readAmount(text: string): { quantity: number; unit: Unit } {
  const t = text.toUpperCase();
  const at = /\b(\d{1,3})\s*[@X]\s*\d/.exec(t);
  if (at) return { quantity: Number(at[1]), unit: 'pcs' };
  const m = /\b(\d+(?:[.,]\d+)?)\s*(KGS?|KILO|GMS?|GRAMS?|G|LTRS?|LITRES?|LITERS?|L|ML|PCS?|PIECES?|PACK|PK|DOZEN|DZ)\b/.exec(t);
  if (!m) return { quantity: 1, unit: 'pcs' };
  const n = Number(m[1]!.replace(',', '.'));
  const u = m[2]!;
  if (/^(KGS?|KILO)$/.test(u)) return { quantity: n, unit: 'kg' };
  if (/^(GMS?|GRAMS?|G)$/.test(u)) return { quantity: n, unit: 'g' };
  if (/^(LTRS?|LITRES?|LITERS?|L)$/.test(u)) return { quantity: n, unit: 'l' };
  if (u === 'ML') return { quantity: n, unit: 'ml' };
  if (u === 'DOZEN' || u === 'DZ') return { quantity: n * 12, unit: 'pcs' };
  return { quantity: Math.max(1, Math.round(n)), unit: 'pcs' };
}

function findDate(text: string): string | null {
  let m = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/.exec(text);
  if (m) {
    const a = Number(m[1]); const b = Number(m[2]);
    const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b]; // ambiguous dates read day-first
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

/** Best-effort parse used when Gemini is unavailable. Far weaker than the AI path, and says so. */
export function parseWithRules(lines: OcrLine[]): RuleResult {
  const text = lines.map((l) => l.text).join('\n');
  const currency = detectCurrency(text);
  // Whole-number prices (rupees, yen...) are allowed when the currency has none, or the receipt shows no cents.
  const centLines = lines.filter((l) => /\d[.,]\d{2}\s*[A-Za-z]?\s*$/.test(l.text)).length;
  const wholeNumbers = (currency.code !== null && ZERO_DECIMAL.has(currency.code)) || centLines < 2;
  const decimals = wholeNumbers ? '(?:[.,]\\d{2})?' : '[.,]\\d{2}';
  const priceAtEnd = new RegExp(`(\\d{1,3}(?:[.,\\s]\\d{3})*${decimals}|\\d+${decimals})\\s*[A-Za-z]?\\s*$`);

  const store = lines.slice(0, 5).map((l) => l.text).find((t) => /[A-Za-z]{3,}/.test(t) && !/\d{3,}/.test(t) && !NOT_ITEM.test(t)) ?? null;
  const out: RuleResult = { store, date: findDate(text), currency, subtotal: null, tax: null, total: null, items: [] };

  lines.forEach((line, idx) => {
    const m = priceAtEnd.exec(line.text);
    if (!m) return;
    const amount = parseAmount(m[1]!);
    if (!Number.isFinite(amount)) return;
    if (/sub\s*-?\s*total/i.test(line.text)) { out.subtotal = amount; return; }
    if (/\btotal\b/i.test(line.text)) { out.total = amount; return; }
    if (/\b(tax|vat|gst|mwst)\b/i.test(line.text)) { out.tax = amount; return; }
    if (NOT_ITEM.test(line.text)) return;
    const name = line.text.slice(0, m.index).replace(/[$€£₹₨¥]|\bRs\.?|\b\d+\s*[xX@]\s*\S*/g, ' ').replace(/[^\p{L}\p{N}\s'&.-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || !/\p{L}{2}/u.test(name)) return;
    out.items.push({ sourceLine: idx, raw: line.text, name, ...readAmount(line.text.slice(0, m.index)), price: amount, category: 'other', isFood: true, certainty: 0.5 });
  });
  return out;
}
