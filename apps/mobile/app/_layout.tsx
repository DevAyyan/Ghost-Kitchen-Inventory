import { startArrivals } from '@/lib/store/arrivals';
import '@/global.css';
import '@/lib/nativewind-interop';

import { AuthGate } from '@/components/auth/auth-gate';
import { Celebration } from '@/components/common/celebration';
import { TourCard } from '@/components/onboarding/tour-card';
import { Toaster } from '@/components/common/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiConfigured } from '@/lib/api';
import { useHydrated } from '@/lib/hooks';
import { useSummarize } from '@/lib/rates';
import { startHouseholdSync } from '@/lib/sync';
import { startProfileSync } from '@/lib/account';
import { startClock } from '@/lib/store/clock';
import { onDigestTapped, syncDigestNotifications } from '@/lib/notifications';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { useServer } from '@/lib/store/server-store';
import { COLORS, NAV_THEME } from '@/lib/theme';
import { PortalHost } from '@rn-primitives/portal';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { View } from 'react-native';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { setColorScheme } = useColorScheme();
  const hydrated = useHydrated();
  // Display face for titles. Not awaited: text renders in the system font until it's ready (or if it fails).
  useFonts({ PixelifySans: require('@/assets/fonts/PixelifySans.ttf'), VT323: require('@/assets/fonts/VT323.ttf') });

  // Dark-only product (design contract).
  useEffect(() => setColorScheme('dark'), [setColorScheme]);
  // Keep next week's "cook tonight" reminders in step with the fridge and the setting.
  const items = useApp((s) => s.items);
  const events = useApp((s) => s.events);
  const receipts = useApp((s) => s.receipts);
  const notifyDigest = useSettings((s) => s.settings.notifyDigest);
  const notifyWeekly = useSettings((s) => s.settings.notifyWeekly);
  const notifyHour = useSettings((s) => s.settings.notifyHour);
  const summarize = useSummarize();
  useEffect(() => {
    if (!hydrated) return;
    const weekly = { enabled: notifyWeekly, events, receipts, fmt: (m: Parameters<typeof summarize>[0]) => summarize(m).text };
    void syncDigestNotifications(items, { enabled: notifyDigest, hour: notifyHour, weekly }).catch(() => {});
  }, [hydrated, items, events, receipts, notifyDigest, notifyWeekly, notifyHour, summarize]);
  // Shared household: keep this device's copy in step with the others.
  useEffect(() => (hydrated ? startHouseholdSync() : undefined), [hydrated]);
  // After loading, so the food already saved doesn't count as just arrived.
  useEffect(() => (hydrated ? startArrivals() : undefined), [hydrated]);
  useEffect(() => startClock(), []);
  // Preferences you change here follow you to your other devices.
  useEffect(() => (hydrated ? startProfileSync() : undefined), [hydrated]);
  const router = useRouter();
  useEffect(() => {
    let off = () => {};
    void onDigestTapped((route) => router.navigate(route as never)).then((f) => { off = f; }).catch(() => {});
    return () => off();
  }, [router]);
  // Learn whether the server is reachable once the saved settings (incl. its address) are loaded.
  // Again when demo mode is switched, which answers for the server.
  const demoMode = useSettings((s) => s.settings.demoMode);
  useEffect(() => {
    if (hydrated && isApiConfigured()) void useServer.getState().check();
  }, [hydrated, demoMode]);

  return (
    <ThemeProvider value={NAV_THEME}>
      <StatusBar style="light" />
      {hydrated ? (
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="review" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="profile" />
            <Stack.Screen name="trust" />
            <Stack.Screen name="sso-callback" />
          </Stack>
        </AuthGate>
      ) : (
        <View className="bg-background flex-1 gap-3 p-6" aria-busy aria-label="Loading your fridge">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </View>
      )}
      <Celebration />
      {hydrated && <TourCard />}
      <Toaster />
      <PortalHost />
    </ThemeProvider>
  );
}
