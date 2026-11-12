/** Currency reference data (rules/currencies.json in the SDS). `digits` = ISO 4217 minor units. */
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  digits: number;
}

const RAW: [string, string, string, number][] = [
  ['USD', 'US Dollar', '$', 2], ['EUR', 'Euro', '€', 2], ['GBP', 'British Pound', '£', 2],
  ['PKR', 'Pakistani Rupee', 'Rs', 0], ['INR', 'Indian Rupee', '₹', 2], ['BDT', 'Bangladeshi Taka', '৳', 2],
  ['LKR', 'Sri Lankan Rupee', 'Rs', 2], ['NPR', 'Nepalese Rupee', 'Rs', 2], ['AED', 'UAE Dirham', 'AED', 2],
  ['SAR', 'Saudi Riyal', 'SAR', 2], ['QAR', 'Qatari Riyal', 'QAR', 2], ['KWD', 'Kuwaiti Dinar', 'KD', 3],
  ['BHD', 'Bahraini Dinar', 'BD', 3], ['OMR', 'Omani Rial', 'OMR', 3], ['EGP', 'Egyptian Pound', 'E£', 2],
  ['TRY', 'Turkish Lira', '₺', 2], ['JPY', 'Japanese Yen', '¥', 0], ['CNY', 'Chinese Yuan', '¥', 2],
  ['KRW', 'South Korean Won', '₩', 0], ['HKD', 'Hong Kong Dollar', 'HK$', 2], ['SGD', 'Singapore Dollar', 'S$', 2],
  ['MYR', 'Malaysian Ringgit', 'RM', 2], ['IDR', 'Indonesian Rupiah', 'Rp', 2], ['PHP', 'Philippine Peso', '₱', 2],
  ['THB', 'Thai Baht', '฿', 2], ['VND', 'Vietnamese Dong', '₫', 0], ['AUD', 'Australian Dollar', 'A$', 2],
  ['NZD', 'New Zealand Dollar', 'NZ$', 2], ['CAD', 'Canadian Dollar', 'C$', 2], ['MXN', 'Mexican Peso', 'MX$', 2],
  ['BRL', 'Brazilian Real', 'R$', 2], ['ARS', 'Argentine Peso', 'AR$', 2], ['CHF', 'Swiss Franc', 'CHF', 2],
  ['SEK', 'Swedish Krona', 'kr', 2], ['NOK', 'Norwegian Krone', 'kr', 2], ['DKK', 'Danish Krone', 'kr', 2],
  ['ISK', 'Icelandic Króna', 'kr', 0], ['PLN', 'Polish Złoty', 'zł', 2], ['CZK', 'Czech Koruna', 'Kč', 2],
  ['HUF', 'Hungarian Forint', 'Ft', 2], ['RON', 'Romanian Leu', 'lei', 2], ['ILS', 'Israeli New Shekel', '₪', 2],
  ['ZAR', 'South African Rand', 'R', 2], ['NGN', 'Nigerian Naira', '₦', 2], ['KES', 'Kenyan Shilling', 'KSh', 2],
];

export const CURRENCIES: CurrencyInfo[] = RAW.map(([code, name, symbol, digits]) => ({ code, name, symbol, digits }));
const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currencyInfo(code: string): CurrencyInfo {
  return BY_CODE.get(code) ?? { code, name: code, symbol: code, digits: 2 };
}
export const isKnownCurrency = (code: string) => BY_CODE.has(code);

/** Device region -> currency, used for the default currency when the OS gives no currency code. */
export const REGION_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', PK: 'PKR', IN: 'INR', BD: 'BDT', LK: 'LKR', NP: 'NPR', AE: 'AED', SA: 'SAR',
  QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', EG: 'EGP', TR: 'TRY', JP: 'JPY', CN: 'CNY', KR: 'KRW',
  HK: 'HKD', SG: 'SGD', MY: 'MYR', ID: 'IDR', PH: 'PHP', TH: 'THB', VN: 'VND', AU: 'AUD', NZ: 'NZD',
  CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK',
  PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', IL: 'ILS', ZA: 'ZAR', NG: 'NGN', KE: 'KES',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR',
  FI: 'EUR', GR: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', LU: 'EUR', MT: 'EUR',
  CY: 'EUR', HR: 'EUR',
};

/** Symbols shared by several currencies. Seeing only one of these means "ask the user". */
export const AMBIGUOUS_SYMBOLS: Record<string, string[]> = {
  $: ['USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'MXN'],
  kr: ['SEK', 'NOK', 'DKK', 'ISK'],
  '¥': ['JPY', 'CNY'],
  Rs: ['PKR', 'INR', 'LKR', 'NPR'],
};
