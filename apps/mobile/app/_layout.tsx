import '@/global.css';
import '@/lib/nativewind-interop';

import { Toaster } from '@/components/common/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiConfigured } from '@/lib/api';
import { useHydrated } from '@/lib/hooks';
import { useSummarize } from '@/lib/rates';
import { startHouseholdSync } from '@/lib/sync';
import { onDigestTapped, syncDigestNotifications } from '@/lib/notifications';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { useServer } from '@/lib/store/server-store';
import { COLORS, NAV_THEME } from '@/lib/theme';
import { GrenzeGotisch_700Bold } from '@expo-google-fonts/grenze-gotisch/700Bold';
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
  useFonts({ GrenzeGotisch_700Bold });

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
  const router = useRouter();
  useEffect(() => {
    let off = () => {};
    void onDigestTapped((route) => router.navigate(route as never)).then((f) => { off = f; }).catch(() => {});
    return () => off();
  }, [router]);
  // Learn whether the server is reachable once the saved settings (incl. its address) are loaded.
  useEffect(() => {
    if (hydrated && isApiConfigured()) void useServer.getState().check();
  }, [hydrated]);

  return (
    <ThemeProvider value={NAV_THEME}>
      <StatusBar style="light" />
      {hydrated ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="review" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      ) : (
        <View className="bg-background flex-1 gap-3 p-6" aria-busy aria-label="Loading your fridge">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </View>
      )}
      <Toaster />
      <PortalHost />
    </ThemeProvider>
  );
}
