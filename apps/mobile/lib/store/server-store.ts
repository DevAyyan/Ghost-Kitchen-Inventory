import { api, ApiError, type RatesResult, type ServerStatus } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ServerState {
  status: ServerStatus | null;
  /** null = not checked yet. */
  reachable: boolean | null;
  lastError: string | null;
  /** Latest exchange-rate snapshot from the server (kept for offline use). */
  rates: RatesResult | null;
  check: () => Promise<ServerStatus | null>;
  refreshRates: (base: string) => Promise<void>;
  markUnreachable: (message: string) => void;
}

const RATES_MAX_AGE_MS = 6 * 60 * 60 * 1000;
let ratesFetchedAt = 0;

export const useServer = create<ServerState>()(
  persist(
    (set, get) => ({
      status: null,
      reachable: null,
      lastError: null,
      rates: null,
      async check() {
        try {
          const status = await api.status();
          set({ status, reachable: true, lastError: null });
          return status;
        } catch (e) {
          set({ reachable: false, lastError: e instanceof ApiError ? e.message : 'Server unreachable.' });
          return null;
        }
      },
      async refreshRates(base) {
        const cur = get().rates;
        if (cur && cur.base === base && Date.now() - ratesFetchedAt < RATES_MAX_AGE_MS) return;
        try {
          const rates = await api.rates(base);
          ratesFetchedAt = Date.now();
          set({ rates });
        } catch {
          // Keep the last snapshot; the ledger shows per-currency totals if there is none.
        }
      },
      markUnreachable: (message) => set({ reachable: false, lastError: message }),
    }),
    {
      name: 'ghost-kitchen-server',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ rates: s.rates }),
    }
  )
);
