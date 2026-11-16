import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { useLayout } from '@/lib/hooks';
import { useSettings } from '@/lib/store/settings-store';
import { useServer } from '@/lib/store/server-store';
import { cn } from '@/lib/utils';
import type { BottomTabBarProps } from 'expo-router/tabs';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { NAV_ITEMS } from './nav-items';

/** One tab bar, two shapes: bottom bar on phones (48dp targets), left rail from md up. */
export function AppTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { isPhone } = useLayout();
  const activeRoute = state.routes[state.index]?.name;
  const items = NAV_ITEMS.filter((n) => !isPhone || n.phone);

  const go = (route: string) => {
    const target = state.routes.find((r) => r.name === route);
    if (!target) return;
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (activeRoute !== route && !event.defaultPrevented) navigation.navigate(route);
  };

  if (isPhone) {
    return (
      <View role="navigation" aria-label="Main" className="border-border bg-card flex-row border-t" style={{ paddingBottom: insets.bottom }}>
        {items.map((n) => {
          const active = activeRoute === n.route;
          return (
            <Pressable
              key={n.route}
              onPress={() => go(n.route)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={n.label}
              className="min-h-16 flex-1 items-center justify-center gap-1 py-2 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
              <View className={cn('rounded-full px-4 py-1', active && 'bg-primary/15')}>
                <Icon as={n.icon} size={20} className={active ? 'text-primary' : 'text-muted-foreground'} />
              </View>
              <Text className={cn('text-xs', active ? 'text-foreground font-semibold' : 'text-muted-foreground')}>{n.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View role="navigation" aria-label="Main" className="border-border bg-card w-56 gap-1 border-r p-3">
      {items.map((n) => {
        const active = activeRoute === n.route;
        return (
          <Pressable
            key={n.route}
            onPress={() => go(n.route)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={cn(
              'web:hover:bg-accent min-h-11 flex-row items-center gap-3 rounded-md px-3 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none',
              active && 'bg-accent'
            )}>
            {active && <View className="bg-primary absolute bottom-2 left-0 top-2 w-0.5 rounded-full" />}
            <Icon as={n.icon} size={18} className={active ? 'text-primary' : 'text-muted-foreground'} />
            <Text className={cn('text-sm', active ? 'font-semibold' : 'text-muted-foreground')}>{n.label}</Text>
          </Pressable>
        );
      })}
      <QuotaMeter />
    </View>
  );
}

function QuotaMeter() {
  const status = useServer((s) => s.status);
  const check = useServer((s) => s.check);
  React.useEffect(() => { void check(); }, [check]);
  const quota = status?.ai.enabled ? { used: status.ai.usedToday, limit: status.ai.limitPerDay } : null;
  const tesseractOnly = useSettings((s) => s.settings.tesseractOnly);
  const reachable = useServer((s) => s.reachable);
  // Says what reading receipts will actually use right now, not an internal state.
  const mode = tesseractOnly
    ? 'Basic receipt reading (AI turned off in Settings)'
    : quota
      ? 'AI receipt reading: requests used today'
      : reachable === false
        ? 'Offline: scanning needs your server'
        : reachable === null
          ? 'Checking your server…'
          : 'Basic receipt reading (AI not set up on the server)';
  return (
    <View className="mt-auto gap-2 p-2">
      <Text className="text-muted-foreground text-xs">
        {mode}
      </Text>
      {!tesseractOnly && quota && (
        <>
          <Text className="text-sm font-semibold tabular-nums">
            {quota.used} / {quota.limit}
          </Text>
          <Progress value={Math.min(100, (quota.used / Math.max(1, quota.limit)) * 100)} className="h-1.5" aria-label="AI requests used today" />
        </>
      )}
    </View>
  );
}
