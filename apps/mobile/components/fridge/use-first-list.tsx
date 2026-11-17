import { FoodPhoto } from '@/components/food/food-photo';
import { StageBadge } from '@/components/stage/stage-badge';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { STAGE_ORDER, ZONES } from '@/lib/domain/catalog';
import { daysLeft, isCookable, remainingText, stageOf } from '@/lib/domain/expiry';
import type { Item, Stage } from '@/lib/domain/types';
import { formatQty } from '@/lib/domain/units';
import { useMotionAllowed } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { CircleCheck, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';

interface UseFirstListProps {
  items: Item[];
  onOpen: (id: string) => void;
  onUsed: (item: Item) => void;
  onBinned: (item: Item) => void;
}

/** How far a row must be dragged before letting go counts as "used" (right) or "binned" (left). */
const SWIPE = 96;

/**
 * The fridge as a list, most urgent first, the way expiry trackers do it: one row per item, grouped by
 * stage. Swipe right when you've used it, left when you've binned it; the buttons on each row do the same
 * for keyboards, screen readers and anyone who'd rather tap.
 */
export function UseFirstList({ items, onOpen, onUsed, onBinned }: UseFirstListProps) {
  const groups = STAGE_ORDER.map((stage) => ({
    stage,
    items: items.filter((i) => stageOf(i) === stage).sort((a, b) => daysLeft(a) - daysLeft(b)),
  })).filter((g) => g.items.length > 0);
  if (groups.length === 0) return <Text className="text-muted-foreground py-6 text-center text-sm">Nothing matches here</Text>;

  return (
    <View className="gap-4">
      <Text className="text-muted-foreground text-xs">Swipe right when you've used something, left when it's binned.</Text>
      {groups.map((g) => (
        <View key={g.stage} role="list" aria-label={`${STAGE_STYLE[g.stage].label}, ${g.items.length}`} className="gap-1.5">
          <GroupHeader stage={g.stage} count={g.items.length} />
          {g.items.map((i) => (
            <Row key={i.id} item={i} onOpen={onOpen} onUsed={onUsed} onBinned={onBinned} />
          ))}
        </View>
      ))}
    </View>
  );
}

function GroupHeader({ stage, count }: { stage: Stage; count: number }) {
  const s = STAGE_STYLE[stage];
  return (
    <View className="flex-row items-center gap-1.5 pt-1">
      <Icon as={s.icon} size={14} className={s.text} />
      <Text role="heading" aria-level={2} className="text-sm font-semibold">{s.label}</Text>
      <Text className="text-muted-foreground text-sm tabular-nums">{count}</Text>
    </View>
  );
}

function Row({ item, onOpen, onUsed, onBinned }: { item: Item } & Omit<UseFirstListProps, 'items'>) {
  const motion = useMotionAllowed();
  const x = React.useRef(new Animated.Value(0)).current;
  const stage = stageOf(item);
  const cookable = isCookable(item);
  const left = item.qty * item.fraction;
  const live = React.useRef({ item, onUsed, onBinned, cookable });
  live.current = { item, onUsed, onBinned, cookable };

  const pan = React.useMemo(
    () =>
      PanResponder.create({
        // Only horizontal drags: vertical ones scroll the page.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_e, g) => {
          // Spoiled and unsafe food can only be binned, so it doesn't move right.
          x.setValue(live.current.cookable ? g.dx : Math.min(0, g.dx));
        },
        onPanResponderRelease: (_e, g) => {
          const { item: it, cookable: ok } = live.current;
          const done = (dir: 1 | -1, act: () => void) =>
            Animated.timing(x, { toValue: dir * 480, duration: motion ? 160 : 0, useNativeDriver: false }).start(act);
          if (g.dx > SWIPE && ok) done(1, () => live.current.onUsed(it));
          else if (g.dx < -SWIPE) done(-1, () => live.current.onBinned(it));
          else Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
      }),
    [x, motion]
  );
  const usedOpacity = x.interpolate({ inputRange: [0, SWIPE], outputRange: [0, 1], extrapolate: 'clamp' });
  const binOpacity = x.interpolate({ inputRange: [-SWIPE, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View role="listitem" className="overflow-hidden rounded-lg">
      {/* What letting go will do, revealed under the row as it slides. */}
      <Animated.View style={{ opacity: usedOpacity }} className="bg-stage-fresh absolute inset-0 flex-row items-center pl-4">
        <Icon as={CircleCheck} size={18} className="text-background" />
        <Text className="text-background ml-2 font-semibold">Used it all</Text>
      </Animated.View>
      <Animated.View style={{ opacity: binOpacity }} className="bg-destructive absolute inset-0 flex-row items-center justify-end pr-4">
        <Text className="ml-2 font-semibold text-white">Binned</Text>
        <Icon as={Trash2} size={18} className="ml-2 text-white" />
      </Animated.View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }} className="border-border bg-card flex-row items-center gap-3 border p-2">
        <Pressable
          onPress={() => onOpen(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${STAGE_STYLE[stage].label}, ${remainingText(daysLeft(item))}. Open details`}
          className="min-w-0 flex-1 flex-row items-center gap-3 web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring">
          <FoodPhoto photoUri={item.photoUri} category={item.category} name={item.name} stage={stage} size="sm" />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="font-semibold" numberOfLines={1}>{item.name}</Text>
            <View className="flex-row flex-wrap items-center gap-x-2">
              <StageBadge stage={stage} />
              <Text className={cn('text-xs tabular-nums', item.expiryConfirmed ? 'text-muted-foreground' : 'text-warning')}>
                {remainingText(daysLeft(item))}{item.expiryConfirmed ? '' : ' · est.'}
              </Text>
            </View>
            <Text className="text-muted-foreground text-xs" numberOfLines={1}>
              {formatQty(left, item.unit)} · {ZONES[item.zone].label}
            </Text>
          </View>
        </Pressable>
        {cookable && (
          <Pressable
            onPress={() => onUsed(item)}
            accessibilityRole="button"
            accessibilityLabel={`Used all of ${item.name}`}
            className="h-11 w-11 items-center justify-center rounded-md active:bg-accent web:hover:bg-accent">
            <Icon as={CircleCheck} size={18} className="text-stage-fresh" />
          </Pressable>
        )}
        <Pressable
          onPress={() => onBinned(item)}
          accessibilityRole="button"
          accessibilityLabel={`Binned ${item.name}`}
          className="h-11 w-11 items-center justify-center rounded-md active:bg-accent web:hover:bg-accent">
          <Icon as={Trash2} size={18} className="text-muted-foreground" />
        </Pressable>
      </Animated.View>
    </View>
  );
}
