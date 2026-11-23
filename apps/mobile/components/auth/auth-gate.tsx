import { Art } from '@/components/halloween/art';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { isApiConfigured } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth-store';
import { useServer } from '@/lib/store/server-store';
import { useSettings } from '@/lib/store/settings-store';
import { ClerkProvider, useAuth, useClerk } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { ClerkBridge } from './clerk-bridge';
import { SignInScreen } from './sign-in-screen';

/** A key baked into the build, used until the server has said which one it uses. */
const BUILD_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

/**
 * Sign-in is required whenever the server asks for it (it reports its Clerk key on /v1/status). Once
 * someone has signed in on this device the app opens for them offline too; a server without sign-in, or
 * no server at all, opens straight away as before.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useServer((s) => s.auth);
  const reachable = useServer((s) => s.reachable);
  const key = auth?.provider === 'clerk' ? auth.publishableKey : auth === null ? BUILD_KEY : '';

  if (!key) {
    // Never reached a server and none is baked in: wait for the first status check, or show why not.
    if (auth === null && isApiConfigured()) {
      if (reachable === null) return <Loading />;
      if (reachable === false) return <Unreachable />;
    }
    return <>{children}</>;
  }
  return (
    <ClerkProvider publishableKey={key} tokenCache={tokenCache}>
      <ClerkBridge />
      <Gate>{children}</Gate>
    </ClerkProvider>
  );
}

/** How long to wait for Clerk before showing the sign-in screen anyway (offline, or Clerk is down). */
const CLERK_LOAD_WAIT_MS = 8_000;

function Gate({ children }: { children: React.ReactNode }) {
  const me = useAuthStore((s) => s.me);
  const prompt = useAuthStore((s) => s.prompt);
  const { isLoaded, isSignedIn } = useAuth();
  const [gaveUpWaiting, setGaveUpWaiting] = React.useState(false);
  React.useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setGaveUpWaiting(true), CLERK_LOAD_WAIT_MS);
    return () => clearTimeout(t);
  }, [isLoaded]);
  // Web: Google sends the browser back here to finish signing in.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname === '/sso-callback') return <SsoCallback />;
  if (!me) {
    // Showing the sign-in screen here would look like the sign-in failed: Clerk is still loading the
    // session Google just made, or has it and the profile is on its way (onSignedIn always sets `me`).
    if (isSignedIn) return <Loading label="Signing you in…" />;
    if (!isLoaded && !gaveUpWaiting) return <Loading />;
    return <SignInScreen />;
  }
  if (prompt) return <SignInScreen onBack={() => useAuthStore.getState().set({ prompt: false })} />;
  return <>{children}</>;
}

/** Finishes a Google sign-in on web, then goes to the fridge. */
function SsoCallback() {
  const clerk = useClerk();
  const router = useRouter();
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    void clerk.handleRedirectCallback({ signInFallbackRedirectUrl: '/', signUpFallbackRedirectUrl: '/' })
      .catch(() => setFailed(true))
      .finally(() => { if (typeof window !== 'undefined') window.history.replaceState(null, '', '/'); });
  }, [clerk]);
  if (failed) {
    return (
      <Centered>
        <Text className="text-center">Signing in with Google didn't finish.</Text>
        <Button className="h-11" onPress={() => router.replace('/')}><Text>Try again</Text></Button>
      </Centered>
    );
  }
  return <Loading label="Finishing sign-in…" />;
}

function Loading({ label = 'Opening your kitchen…' }: { label?: string }) {
  return (
    <Centered>
      <Art name="ghost" size={48} />
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Skeleton className="h-3 w-40" />
    </Centered>
  );
}

function Unreachable() {
  const saved = useSettings((s) => s.settings.apiUrl);
  const [url, setUrl] = React.useState(saved);
  const [checking, setChecking] = React.useState(false);
  const retry = async () => {
    setChecking(true);
    if (url.trim() !== saved) useSettings.getState().update({ apiUrl: url.trim() });
    await useServer.getState().check();
    setChecking(false);
  };
  return (
    <Centered>
      <Art name="ghost" size={48} />
      <Text role="heading" aria-level={1} className="font-display text-center text-2xl">Can't reach your server</Text>
      <Text className="text-muted-foreground max-w-sm text-center text-sm">
        Ghost Kitchen needs its server once, to sign you in. After that it works offline too.
      </Text>
      {/* The web app is served by its server; a phone may need the address fixed here, before Settings opens. */}
      {Platform.OS !== 'web' && (
        <Input
          value={url}
          onChangeText={setUrl}
          placeholder="https://kitchen.example.com"
          accessibilityLabel="Server address"
          autoCapitalize="none"
          keyboardType="url"
          className="h-11 w-full max-w-sm"
        />
      )}
      <Button className="h-11" onPress={retry} disabled={checking}><Text>{checking ? 'Trying…' : 'Try again'}</Text></Button>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View className="bg-background flex-1 items-center justify-center gap-4 p-6">{children}</View>;
}
