import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from './storage';

export interface Household {
  id: string;
  name: string;
  /** `<household id>.<this device's secret>`. Anyone holding it can read and change the shared data. */
  key: string;
  members: number;
}

interface HouseholdState {
  household: Household | null;
  /** Random, per install: lets the server tell this device's writes apart. */
  deviceId: string;
  /** Last server change this device has seen. */
  cursor: number;
  /** `collection:id` -> when it changed here, for local changes not yet on the server. */
  pending: Record<string, number>;
  lastSyncAt: number | null;
  lastError: string | null;
  syncing: boolean;
  set: (patch: Partial<Omit<HouseholdState, 'set'>>) => void;
}

const randomId = () => Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('');

export const useHousehold = create<HouseholdState>()(
  persist(
    (set) => ({
      household: null,
      deviceId: randomId(),
      cursor: 0,
      pending: {},
      lastSyncAt: null,
      lastError: null,
      syncing: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'ghost-kitchen-household',
      version: 1,
      storage: createJSONStorage(() => safeStorage('household')),
      partialize: ({ household, deviceId, cursor, pending, lastSyncAt }) => ({ household, deviceId, cursor, pending, lastSyncAt }),
    }
  )
);
