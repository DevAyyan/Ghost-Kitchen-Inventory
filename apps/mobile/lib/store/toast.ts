import { create } from 'zustand';

/** An optional button on a toast, e.g. "Add to list" after binning something. */
export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastState {
  message: string | null;
  action: ToastAction | null;
  key: number;
  show: (message: string, action?: ToastAction) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** One toast at a time; the Toaster component announces it politely to screen readers. */
export const useToast = create<ToastState>((set) => ({
  message: null,
  action: null,
  key: 0,
  show: (message, action) => {
    clearTimeout(timer);
    set((s) => ({ message, action: action ?? null, key: s.key + 1 }));
    // A toast with a button stays longer, so there's time to reach it.
    timer = setTimeout(() => set({ message: null, action: null }), action ? 7000 : 3200);
  },
  hide: () => set({ message: null, action: null }),
}));

export const toast = (message: string, action?: ToastAction) => useToast.getState().show(message, action);
