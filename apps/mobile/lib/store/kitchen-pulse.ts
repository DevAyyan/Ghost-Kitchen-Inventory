import type { Zone } from '@/lib/domain/types';
import { create } from 'zustand';

/**
 * "Something just happened behind this door": set when a housemate's change arrives through household sync,
 * so the kitchen scene can rattle that door and let a ghost look out. Not persisted.
 */
interface Pulse {
  zones: Zone[];
  at: number;
  pulse: (zones: Zone[]) => void;
}

export const useKitchenPulse = create<Pulse>((set) => ({
  zones: [],
  at: 0,
  pulse: (zones) => { if (zones.length) set({ zones, at: Date.now() }); },
}));
