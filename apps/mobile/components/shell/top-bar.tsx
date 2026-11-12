import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isHaunting, stageOf } from '@/lib/domain/expiry';
import { useActiveItems, useLayout } from '@/lib/hooks';
import { useApp } from '@/lib/store/app-store';
import { useRouter } from 'expo-router';
import { Flame, Ghost, Settings, Sparkles } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function TopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPhone } = useLayout();
  const items = useActiveItems();
  const haunting = items.filter((i) => isHaunting(stageOf(i))).length;

  return (
    <View className="border-border bg-card border-b" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center gap-2 px-4">
        <View className="flex-1 flex-row items-center gap-2">
          <Icon as={Ghost} size={22} className="text-primary" />
          <Text className="font-display text-2xl leading-7">Ghost Kitchen</Text>
        </View>
        <Pressable
          onPress={() => router.navigate({ pathname: '/', params: { stage: 'haunting' } })}
          accessibilityRole="button"
          accessibilityLabel={`${haunting} items need attention. Show them`}
          className="border-stage-expiring/50 bg-stage-expiring/10 h-11 flex-row items-center gap-1.5 rounded-full border px-3 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
          <Icon as={Flame} size={16} className="text-stage-expiring" />
          <Text className="text-sm font-semibold tabular-nums">{haunting}</Text>
          {!isPhone && <Text className="text-muted-foreground text-sm">haunting</Text>}
        </Pressable>
        {isPhone ? (
          <Pressable
            onPress={() => router.navigate('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            className="active:bg-accent h-11 w-11 items-center justify-center rounded-md web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
            <Icon as={Settings} size={20} className="text-muted-foreground" />
          </Pressable>
        ) : (
          <Button onPress={() => router.navigate({ pathname: '/recipes', params: { summon: '1' } })}>
            <Icon as={Sparkles} size={16} className="text-primary-foreground" />
            <Text>Summon recipes</Text>
          </Button>
        )}
      </View>
    </View>
  );
}
