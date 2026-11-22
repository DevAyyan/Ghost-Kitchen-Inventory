import { Art } from '@/components/halloween/art';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/store/auth-store';
import { isClerkAPIResponseError, useSSO } from '@clerk/expo';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, Globe } from 'lucide-react-native';
import * as React from 'react';
import { Platform, ScrollView, View } from 'react-native';

// Web: lets the sign-in popup or redirect hand its result back to this tab. Does nothing on Android.
WebBrowser.maybeCompleteAuthSession();

/** Clerk's own wording is fine for most errors; these few are said more plainly. */
function message(e: unknown): string {
  if (isClerkAPIResponseError(e)) {
    const err = e.errors[0];
    if (err?.code === 'form_code_incorrect') return "That code isn't right. Check the email and try again.";
    if (err?.code === 'verification_expired') return 'That code has expired. Send a new one.';
    if (err?.code === 'form_param_format_invalid') return "That doesn't look like an email address.";
    return err?.longMessage ?? err?.message ?? 'Signing in failed. Try again.';
  }
  return "Can't reach the sign-in service. Check your connection and try again.";
}

type Step = { kind: 'start' } | { kind: 'code'; email: string; mode: 'sign-in' | 'sign-up' };

/**
 * Sign in or sign up in one place, in the app's own pixel style: Google, or an emailed 6-digit code
 * (no passwords). Clerk runs the accounts; Google uses Clerk's shared development credentials until the
 * Clerk app is moved to production with its own.
 */
export function SignInScreen({ onBack }: { onBack?: () => void }) {
  const { signIn, setActive, isLoaded: signInReady } = useSignIn();
  const { signUp, isLoaded: signUpReady } = useSignUp();
  const { startSSOFlow } = useSSO();
  const [step, setStep] = React.useState<Step>({ kind: 'start' });
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState<'google' | 'email' | 'code' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const ready = signInReady && signUpReady;

  const done = async (sessionId: string | null | undefined) => {
    if (!sessionId || !setActive) throw new Error('incomplete');
    await setActive({ session: sessionId });
    useAuthStore.getState().set({ prompt: false });
  };

  const google = async () => {
    if (!ready || !signIn) return;
    setError(null);
    setBusy('google');
    try {
      if (Platform.OS === 'web') {
        // A full-page redirect: popups get blocked, and this returns to /sso-callback.
        await signIn.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl: '/sso-callback', redirectUrlComplete: '/' });
        return;
      }
      const res = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'ghostkitchen', path: 'sso-callback' }),
      });
      // Closing the browser without choosing an account isn't an error.
      if (res.createdSessionId) await done(res.createdSessionId);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  const sendCode = async () => {
    if (!ready || !signIn || !signUp) return;
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError("That doesn't look like an email address.");
    setError(null);
    setBusy('email');
    try {
      try {
        const attempt = await signIn.create({ identifier: address });
        const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
        if (!factor || !('emailAddressId' in factor)) throw new Error('no email code');
        await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
        setStep({ kind: 'code', email: address, mode: 'sign-in' });
      } catch (e) {
        // A new email: the same code makes an account.
        if (!isClerkAPIResponseError(e) || e.errors[0]?.code !== 'form_identifier_not_found') throw e;
        await signUp.create({ emailAddress: address });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setStep({ kind: 'code', email: address, mode: 'sign-up' });
      }
      setCode('');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    if (step.kind !== 'code' || !signIn || !signUp) return;
    setError(null);
    setBusy('code');
    try {
      if (step.mode === 'sign-in') {
        const res = await signIn.attemptFirstFactor({ strategy: 'email_code', code: code.trim() });
        if (res.status !== 'complete') throw new Error('incomplete');
        await done(res.createdSessionId);
      } else {
        const res = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (res.status !== 'complete') {
          // The Clerk app asks for more than an email (e.g. a password). The setup guide turns that off.
          setError('This server needs more sign-up details than the app asks for. Ask whoever runs it to check the Clerk settings.');
          return;
        }
        await done(res.createdSessionId);
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="flex-grow items-center justify-center p-6" keyboardShouldPersistTaps="handled">
      <View className="border-border bg-card w-full max-w-sm gap-5 border-2 border-b-4 p-6">
        {onBack && (
          <Button variant="ghost" className="-ml-3 h-11 self-start" onPress={onBack}>
            <Icon as={ArrowLeft} size={16} />
            <Text>Not now</Text>
          </Button>
        )}
        <View className="items-center gap-2">
          <Art name="ghost" size={64} />
          <Text role="heading" aria-level={1} className="font-display text-center text-3xl">Ghost Kitchen</Text>
          <Text className="text-muted-foreground text-center text-sm">
            {step.kind === 'code' ? `We sent a 6-digit code to ${step.email}.` : 'Sign in to open your kitchen. New here? The same steps make your account.'}
          </Text>
        </View>

        {step.kind === 'start' ? (
          <View className="gap-3">
            <Button className="h-11" onPress={google} disabled={!ready || !!busy} accessibilityLabel="Continue with Google">
              <Icon as={Globe} size={16} className="text-primary-foreground" />
              <Text>{busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</Text>
            </Button>
            <View className="flex-row items-center gap-2" aria-hidden>
              <View className="bg-border h-0.5 flex-1" />
              <Text className="text-muted-foreground text-xs">or with email</Text>
              <View className="bg-border h-0.5 flex-1" />
            </View>
            <Input
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={sendCode}
              placeholder="you@example.com"
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              className="h-11"
            />
            <Button variant="outline" className="h-11" onPress={sendCode} disabled={!ready || !!busy || !email.trim()}>
              <Text>{busy === 'email' ? 'Sending…' : 'Email me a code'}</Text>
            </Button>
          </View>
        ) : (
          <View className="gap-3">
            <Input
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              onSubmitEditing={verify}
              placeholder="123456"
              accessibilityLabel="6-digit code from the email"
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              className="h-11 text-center tracking-widest"
              autoFocus
            />
            <Button className="h-11" onPress={verify} disabled={!!busy || code.length !== 6}>
              <Text>{busy === 'code' ? 'Checking…' : step.mode === 'sign-up' ? 'Make my account' : 'Sign in'}</Text>
            </Button>
            <View className="flex-row flex-wrap justify-center gap-2">
              <Button variant="ghost" className="h-11" onPress={sendCode} disabled={!!busy}>
                <Text>Send a new code</Text>
              </Button>
              <Button variant="ghost" className="h-11" onPress={() => { setStep({ kind: 'start' }); setError(null); }} disabled={!!busy}>
                <Text>Use a different email</Text>
              </Button>
            </View>
          </View>
        )}

        {error && <Text role="alert" className="text-destructive text-center text-sm">{error}</Text>}
        <Text className="text-muted-foreground text-center text-xs">
          Your food stays on this device. Your account keeps your profile and lets you share a kitchen.
        </Text>
      </View>
    </ScrollView>
  );
}
