import { Pulse } from '@/components/common/pixel-motion';
import { Art } from '@/components/halloween/art';
import { Pumpkin } from '@/components/halloween/lab-icons';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isApiConfigured } from '@/lib/api';
import { isHaunting, stageOf } from '@/lib/domain/expiry';
import { useActiveItems, useLayout } from '@/lib/hooks';
import { useServer } from '@/lib/store/server-store';
import { useSettings } from '@/lib/store/settings-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { GhostAvatar } from '@/components/profile/ghost-avatar';
import { usePathname, useRouter } from 'expo-router';
import { LogIn, Settings, Sparkles, WifiOff } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function TopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPhone, hasSidePanel } = useLayout();
  // Only the fridge screen has the "Haunting now" panel, which repeats the badge's count and the recipes button.
  const pathname = usePathname();
  const panelShown = hasSidePanel && pathname === '/';
  const items = useActiveItems();
  const haunting = items.filter((i) => isHaunting(stageOf(i))).length;
  const demoMode = useSettings((s) => s.settings.demoMode);
  const offline = useServer((s) => s.reachable === false) && isApiConfigured() && !demoMode;
  const me = useAuthStore((s) => s.me);
  const needsSignIn = useAuthStore((s) => s.needsSignIn);

  return (
    <View className="border-border bg-card border-b" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center gap-2 px-4">
        <View className="flex-1 flex-row items-center gap-2">
          <Art name="ghost" size={24} />
          {/* A step smaller on narrow phones, where the full size wrapped onto two lines. */}
          <Text numberOfLines={1} className="font-display text-xl leading-6 sm:text-2xl sm:leading-7">Ghost Kitchen</Text>
        </View>
        {/* Steps aside where the "Haunting now" panel shows the same count, and when nothing is haunting:
            a "0" badge is only noise. */}
        {!panelShown && haunting > 0 && <Pressable
          onPress={() => router.navigate({ pathname: '/', params: { stage: 'haunting' } })}
          accessibilityRole="button"
          accessibilityLabel={`${haunting} items need attention. Show them`}
          className="border-stage-expiring/50 bg-stage-expiring/10 h-11 flex-row items-center gap-1.5 rounded-sm border px-3 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
          <Pulse trigger={haunting} className="flex-row items-center gap-1.5">
            <Icon as={Pumpkin} size={16} className="text-stage-expiring" />
            <Text className="text-sm font-semibold tabular-nums">{haunting}</Text>
          </Pulse>
          {!isPhone && <Text className="text-muted-foreground text-sm">haunting</Text>}
        </Pressable>}
        {needsSignIn && me && (
          <Pressable
            onPress={() => useAuthStore.getState().set({ prompt: true })}
            accessibilityRole="button"
            accessibilityLabel="Signed out. Sign in again to sync"
            className="border-warning/60 bg-warning/10 h-11 flex-row items-center gap-1.5 border-2 px-3 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
            <Icon as={LogIn} size={16} className="text-warning" />
            {!isPhone && <Text className="text-sm">Sign in to sync</Text>}
          </Pressable>
        )}
        {demoMode && (
          <Pressable
            onPress={() => router.navigate('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Demo mode is on: scans and recipes use recorded sample answers. Open settings"
            className="border-primary/60 bg-primary/10 h-11 min-w-11 flex-row items-center justify-center gap-1.5 rounded-sm border px-3 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
            <Icon as={Sparkles} size={16} className="text-primary" />
            {!isPhone && <Text className="text-sm">Demo</Text>}
          </Pressable>
        )}
        {offline && (
          // The fridge works offline, so this stays small; Settings is where the server address is fixed.
          <Pressable
            onPress={() => router.navigate('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Offline: can't reach your Ghost Kitchen server. Your fridge works offline; scanning and recipes need the server. Open settings"
            className="border-warning/60 bg-warning/10 h-11 min-w-11 flex-row items-center justify-center gap-1.5 rounded-sm border px-3 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
            <Icon as={WifiOff} size={16} className="text-warning" />
            {!isPhone && <Text className="text-sm">Offline</Text>}
          </Pressable>
        )}
        {isPhone ? (
          <Pressable
            onPress={() => router.navigate('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            className="active:bg-accent h-11 w-11 items-center justify-center rounded-md web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
            <Icon as={Settings} size={20} className="text-muted-foreground" />
          </Pressable>
        ) : panelShown || pathname !== '/' ? null : (
          // Only on the fridge, where the food it's about is. Other screens have their own job (Recipes has
          // its own Find button), and at ≥ 1280 px the "Haunting now" panel carries it instead.
          <Button onPress={() => router.navigate({ pathname: '/recipes', params: { summon: '1' } })}>
            <Icon as={Sparkles} size={16} className="text-primary-foreground" />
            <Text>Summon recipes</Text>
          </Button>
        )}
        {/* The signed-in person's ghost opens their profile. */}
        {me && (
          <Pressable
            onPress={() => router.navigate('/profile')}
            accessibilityRole="button"
            accessibilityLabel={`${me.displayName}: your profile`}
            className="h-11 w-11 items-center justify-center web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
            <GhostAvatar avatar={me.avatar} size={36} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
