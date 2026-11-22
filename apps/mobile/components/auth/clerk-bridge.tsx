import { onSignedIn } from '@/lib/account';
import { setTokenGetter, useAuthStore } from '@/lib/store/auth-store';
import { useAuth, useUser } from '@clerk/expo';
import * as React from 'react';

/**
 * Connects Clerk to the rest of the app: hands the session token to the API client, and loads the
 * profile whenever someone signs in. Renders nothing.
 *
 * A session that runs out doesn't sign the person out of the app (the food on this device stays usable,
 * offline too); the server's 401 sets `needsSignIn` and the top bar asks them to sign in again to sync.
 */
export function ClerkBridge() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  React.useEffect(() => {
    setTokenGetter(isSignedIn ? () => getToken() : null);
    return () => setTokenGetter(null);
  }, [isSignedIn, getToken]);

  React.useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && userId) void onSignedIn(userId, email);
    // Signed out by Clerk (expired, or revoked on another device) while someone is remembered here.
    else if (useAuthStore.getState().me) useAuthStore.getState().set({ needsSignIn: true });
  }, [isLoaded, isSignedIn, userId, email]);

  return null;
}
