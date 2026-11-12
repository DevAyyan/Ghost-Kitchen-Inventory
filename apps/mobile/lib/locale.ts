import { REGION_CURRENCY, isKnownCurrency } from '@/lib/currency/catalog';
import { getLocales } from 'expo-localization';

/** Default currency from the device locale (FR-CUR-5). Falls back to USD. */
export function deviceCurrency(): string {
  try {
    const [locale] = getLocales();
    if (locale?.currencyCode && isKnownCurrency(locale.currencyCode)) return locale.currencyCode;
    if (locale?.regionCode && REGION_CURRENCY[locale.regionCode]) return REGION_CURRENCY[locale.regionCode];
  } catch {
    // Locale APIs can be missing in some web environments.
  }
  return 'USD';
}

export function deviceLocaleTag(): string {
  try {
    return getLocales()[0]?.languageTag ?? 'en-US';
  } catch {
    return 'en-US';
  }
}
