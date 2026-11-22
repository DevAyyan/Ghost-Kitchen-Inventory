import type { Avatar, Prefs } from '@/lib/domain/profile';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from './storage';

/**
 * Who is signed in on this device, kept so the app works offline once you've signed in (a phone without
 * signal still shows its food). Clerk holds the actual session; this is what the app needs without it.
 */
export interface Me {
  id: string;
  displayName: string;
  avatar: Avatar;
  prefs: Prefs;
  email?: string;
}

interface AuthState {
  /** The last person who signed in here and hasn't signed out. Null: sign in to use the app. */
  me: Me | null;
  /** The server turned a request away because the session ran out: sign in again to sync. */
  needsSignIn: boolean;
  /** Show the sign-in screen over the app (someone remembered here chose "Sign in again"). Not kept. */
  prompt: boolean;
  set: (patch: Partial<Omit<AuthState, 'set'>>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({ me: null, needsSignIn: false, prompt: false, set: (patch) => set(patch) }),
    {
      name: 'ghost-kitchen-auth',
      version: 1,
      storage: createJSONStorage(() => safeStorage('account')),
      partialize: ({ me }) => ({ me }),
    }
  )
);

/**
 * The current session token, supplied by Clerk (see components/auth/clerk-bridge.tsx). Null when sign-in is
 * off or nobody is signed in. Kept outside React so the API client can ask for it.
 */
let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(get: (() => Promise<string | null>) | null) {
  tokenGetter = get;
}

export async function sessionToken(): Promise<string | null> {
  try {
    return (await tokenGetter?.()) ?? null;
  } catch {
    // Offline, or the session expired: the request goes without, and the server says so.
    return null;
  }
}
