import { Hop } from '@/components/common/pixel-motion';
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
              <Hop on={active} className={cn('rounded-sm px-4 py-1', active && 'bg-primary/15')}>
                <Icon as={n.icon} size={20} className={active ? 'text-primary' : 'text-muted-foreground'} />
              </Hop>
              <Text className={cn('text-sm leading-5', active ? 'text-foreground font-semibold' : 'text-muted-foreground')}>{n.label}</Text>
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
            {active && <View className="bg-primary absolute bottom-2 left-0 top-2 w-0.5 rounded-sm" />}
            <Icon as={n.icon} size={18} className={active ? 'text-primary' : 'text-muted-foreground'} />
            <Text className={cn('text-sm', active ? 'font-semibold' : 'text-muted-foreground')}>{n.label}</Text>
          </Pressable>
        );
      })}
      <QuotaMeter />
    </View>
  );
}

/** Share of the day's AI requests after which the sidebar warns. Below it, the numbers live in Settings. */
const QUOTA_WARN_AT = 0.8;

/**
 * A warning in the sidebar when AI receipt reading is about to run out for the day. Everyday usage and the
 * reading mode are in Settings → Server; here they only took up space nobody needed.
 */
function QuotaMeter() {
  const status = useServer((s) => s.status);
  const check = useServer((s) => s.check);
  React.useEffect(() => { void check(); }, [check]);
  const tesseractOnly = useSettings((s) => s.settings.tesseractOnly);
  if (tesseractOnly || !status?.ai.enabled) return null;
  const { usedToday: used, limitPerDay: limit } = status.ai;
  if (used < limit * QUOTA_WARN_AT) return null;
  const left = Math.max(0, limit - used);
  return (
    <View role="status" className="border-warning/60 bg-warning/10 mt-auto gap-2 rounded-md border p-3">
      <Text className="text-sm font-semibold">
        {left === 0 ? 'AI reading is used up for today' : `${left} AI reading${left === 1 ? '' : 's'} left today`}
      </Text>
      <Text className="text-muted-foreground text-xs">
        {left === 0 ? 'Receipts are read with basic rules until tomorrow.' : 'After that, receipts are read with basic rules until tomorrow.'}
      </Text>
      <Progress value={Math.min(100, (used / Math.max(1, limit)) * 100)} className="h-1.5" aria-label="AI readings used today" />
    </View>
  );
}
