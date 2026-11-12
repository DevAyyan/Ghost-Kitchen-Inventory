import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';
import { toast } from './toast';

let lastWarned = 0;

/**
 * AsyncStorage that never fails silently. A failed write (on web, usually the ~5 MB localStorage quota
 * filling up with photos) shows a toast at most every 30 s instead of being an unhandled rejection.
 * `legacy` supplies a value when the key has never been written (used to carry settings over from the
 * old combined blob). Both keys are read in one call, before any other store can rewrite the old one.
 */
export function safeStorage(what: string, legacy?: { key: string; extract: (raw: string) => string | null }): StateStorage {
  return {
    getItem: async (name) => {
      try {
        if (!legacy) return await AsyncStorage.getItem(name);
        const [[, own], [, old]] = await AsyncStorage.multiGet([name, legacy.key]);
        if (own != null) return own;
        return old != null ? legacy.extract(old) : null;
      } catch {
        return null;
      }
    },
    setItem: async (name, value) => {
      try {
        await AsyncStorage.setItem(name, value);
      } catch {
        if (Date.now() - lastWarned > 30_000) {
          lastWarned = Date.now();
          toast(`Couldn't save your ${what}: this device's storage is full. Removing some food photos frees space.`);
        }
      }
    },
    removeItem: async (name) => {
      try { await AsyncStorage.removeItem(name); } catch { /* nothing to remove */ }
    },
  };
}
