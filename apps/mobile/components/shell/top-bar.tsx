import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isApiConfigured } from '@/lib/api';
import { isHaunting, stageOf } from '@/lib/domain/expiry';
import { useActiveItems, useLayout } from '@/lib/hooks';
import { useServer } from '@/lib/store/server-store';
import { usePathname, useRouter } from 'expo-router';
import { Flame, Ghost, Settings, Sparkles, WifiOff } from 'lucide-react-native';
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
  const offline = useServer((s) => s.reachable === false) && isApiConfigured();

  return (
    <View className="border-border bg-card border-b" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center gap-2 px-4">
        <View className="flex-1 flex-row items-center gap-2">
          <Icon as={Ghost} size={22} className="text-primary" />
          <Text className="font-display text-2xl leading-7">Ghost Kitchen</Text>
        </View>
        {/* Steps aside where the "Haunting now" panel shows the same count. */}
        {!panelShown && <Pressable
          onPress={() => router.navigate({ pathname: '/', params: { stage: 'haunting' } })}
          accessibilityRole="button"
          accessibilityLabel={`${haunting} items need attention. Show them`}
          className="border-stage-expiring/50 bg-stage-expiring/10 h-11 flex-row items-center gap-1.5 rounded-full border px-3 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
          <Icon as={Flame} size={16} className="text-stage-expiring" />
          <Text className="text-sm font-semibold tabular-nums">{haunting}</Text>
          {!isPhone && <Text className="text-muted-foreground text-sm">haunting</Text>}
        </Pressable>}
        {offline && (
          // The fridge works offline, so this stays small; Settings is where the server address is fixed.
          <Pressable
            onPress={() => router.navigate('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Offline: can't reach your Ghost Kitchen server. Your fridge works offline; scanning and recipes need the server. Open settings"
            className="border-warning/60 bg-warning/10 h-11 min-w-11 flex-row items-center justify-center gap-1.5 rounded-full border px-3 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
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
        ) : panelShown ? null : (
          // At ≥ 1280 px the "Haunting now" panel has "Summon rescue recipes" right by the food it's about.
          <Button onPress={() => router.navigate({ pathname: '/recipes', params: { summon: '1' } })}>
            <Icon as={Sparkles} size={16} className="text-primary-foreground" />
            <Text>Summon recipes</Text>
          </Button>
        )}
      </View>
    </View>
  );
}
