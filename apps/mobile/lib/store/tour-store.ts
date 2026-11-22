import { TOUR } from '@/lib/domain/tour';
import { create } from 'zustand';

/** The guided tour's place. Not saved: a reload ends the tour, and the app is exactly as it was. */
interface TourState {
  /** Current stop, or null when the tour isn't running. */
  step: number | null;
  /** Folded down to a small pill, so the page underneath can be seen. */
  folded: boolean;
  start: () => void;
  go: (step: number) => void;
  end: () => void;
  setFolded: (folded: boolean) => void;
}

export const useTour = create<TourState>((set) => ({
  step: null,
  folded: false,
  start: () => set({ step: 0, folded: false }),
  go: (step) => set({ step: Math.max(0, Math.min(TOUR.length - 1, step)), folded: false }),
  end: () => set({ step: null, folded: false }),
  setFolded: (folded) => set({ folded }),
}));
