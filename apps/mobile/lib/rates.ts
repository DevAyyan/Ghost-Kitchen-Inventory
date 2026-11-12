import { summarize, type MoneySummary } from '@/lib/currency/money';
import { addDays, today } from '@/lib/domain/dates';
import type { IsoDate, Money } from '@/lib/domain/types';
import { useSettings } from '@/lib/store/settings-store';
import { useServer } from '@/lib/store/server-store';
import * as React from 'react';

/** Rates usable for the display currency right now (the snapshot's base must be the display currency). */
export function useRatesFor(display: string) {
  const rates = useServer((s) => s.rates);
  const refresh = useServer((s) => s.refreshRates);
  React.useEffect(() => { void refresh(display); }, [display, refresh]);
  return rates && rates.base === display ? rates : null;
}

/** Money summary in the display currency, converted with live rates when available. */
export function useSummarize() {
  const display = useSettings((s) => s.settings.displayCurrency);
  const rates = useRatesFor(display);
  return React.useCallback((entries: Money[]): MoneySummary => summarize(entries, display, rates?.rates), [display, rates]);
}

/** Rolling window used by the ledger and side panel ("Last 30 days"). */
export const LEDGER_DAYS = 30;
export const withinLedgerWindow = (date: IsoDate) => date >= addDays(today(), -LEDGER_DAYS);
