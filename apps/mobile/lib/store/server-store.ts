import { api, ApiError, type RatesResult, type ServerAuth, type ServerStatus } from '@/lib/api';
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
  /**
   * How this server signs people in, from its last status reply. Kept, so a phone that's offline still
   * knows (and keeps letting its signed-in person in). Null: never reached.
   */
  auth: ServerAuth | null;
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
      auth: null,
      async check() {
        try {
          const status = await api.status();
          set({ status, reachable: true, lastError: null, auth: status.auth ?? { provider: 'none' } });
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
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ rates: s.rates, auth: s.auth }),
      // v1 kept only exchange rates. The sign-in mode is learned on the next status check.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as { rates?: RatesResult | null; auth?: ServerAuth | null };
        if (version < 2) s.auth = null;
        return s as unknown as ServerState;
      },
    }
  )
);
