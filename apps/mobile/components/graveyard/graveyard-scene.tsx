import { FoodPhoto } from '@/components/food/food-photo';
import { Gradient } from '@/components/fridge/gradient';
import { useLoop } from '@/components/fridge/haunt-effects';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/currency/money';
import { shortDate } from '@/lib/domain/dates';
import { seeded, stoneSize } from '@/lib/domain/haunt';
import type { ItemEvent } from '@/lib/domain/types';
import { MATERIALS } from '@/lib/theme';
import { useApp } from '@/lib/store/app-store';
import { eventPhoto } from '@/lib/store/migrations';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

const EPITAPHS = [
  'Gone, but not forgotten in the crisper.', 'Should have been an omelette.', 'Lost behind the ketchup.',
  'It had so much left to give.', 'Rest in pieces.', 'Forever fresh in our hearts.', 'Eaten by no one.',
];

/** Literal class names per size so NativeWind can find them. Wider stone = more money lost. */
const SIZE = {
  sm: { stone: 'w-32', mound: 'w-36' },
  md: { stone: 'w-36', mound: 'w-40' },
  lg: { stone: 'w-40', mound: 'w-44' },
} as const;

/**
 * Headroom above the engraving, in px, for the cheapest and the costliest grave. Height follows the money
 * lost in proportion (not in three steps), so "the bigger the stone, the more it cost" reads at a glance.
 */
const HEADROOM = { min: 12, max: 96 };

/** A moonlit plot: one tombstone per item thrown away, newest first. */
export function GraveyardScene({ graves }: { graves: ItemEvent[] }) {
  const max = Math.max(0, ...graves.map((g) => g.minor));
  const items = useApp((s) => s.items);
  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  return (
    // Taller on wide screens, with the stones standing on the ground at the bottom of the plot.
    <Gradient colors={MATERIALS.night} className="border-border justify-end rounded-lg border md:min-h-96">
      <Moon />
      <View role="list" className="flex-row flex-wrap items-end justify-center gap-x-4 gap-y-6 px-3 pt-16">
        {graves.map((g) => (
          <Tombstone key={g.id} grave={g} photo={eventPhoto(g, byId)} size={stoneSize(g.minor, max)} share={max > 0 ? g.minor / max : 0} />
        ))}
      </View>
      <Gradient colors={MATERIALS.earth} className="h-4" aria-hidden importantForAccessibility="no-hide-descendants" />
      <Fog />
    </Gradient>
  );
}

function Tombstone({ grave: g, photo, size, share }: { grave: ItemEvent; photo?: string; size: 'sm' | 'md' | 'lg'; share: number }) {
  // Stable per grave, so stones don't reshuffle between renders: shape, lean and epitaph.
  const look = React.useMemo(() => {
    const rand = seeded(g.id);
    return {
      arch: rand() > 0.4,
      lean: (rand() - 0.5) * 3,
      epitaph: EPITAPHS[Math.floor(rand() * EPITAPHS.length)],
    };
  }, [g.id]);
  const s = SIZE[size];
  const lost = formatMoney(g.minor, g.currency);

  return (
    <View
      role="listitem"
      accessible
      accessibilityLabel={`${g.name}, buried ${shortDate(g.date)}, ${lost} lost`}
      className="items-center">
      <View style={{ transform: [{ rotate: `${look.lean}deg` }] }}>
        <Gradient
          colors={MATERIALS.stone}
          className={cn('items-center gap-1 border-2 px-3 pb-3', s.stone, look.arch ? 'rounded-t-full' : 'rounded-t-lg')}
          style={{ borderColor: MATERIALS.stoneEdge, paddingTop: Math.round(HEADROOM.min + share * (HEADROOM.max - HEADROOM.min)) }}>
          <Text className="font-display text-sm tracking-widest" style={{ color: MATERIALS.stoneText }}>
            R.I.P.
          </Text>
          <FoodPhoto photoUri={photo} category={g.category} name={g.name} stage="spoiled" size="sm" />
          <Text numberOfLines={2} className="font-display text-center text-xl leading-6" style={{ color: MATERIALS.stoneText }}>
            {g.name}
          </Text>
          <Text className="text-xs tabular-nums" style={{ color: MATERIALS.stoneText, opacity: 0.85 }}>
            {g.purchased ? `${shortDate(g.purchased)} – ` : ''}
            {shortDate(g.date)}
          </Text>
          <Text className="text-center text-xs italic" style={{ color: MATERIALS.stoneText, opacity: 0.85 }}>
            “{look.epitaph}”
          </Text>
          <View className="mt-1 rounded bg-black/40 px-2 py-0.5">
            <Text className="text-destructive text-sm font-semibold tabular-nums">−{lost}</Text>
          </View>
        </Gradient>
      </View>
      {/* Fresh earth in front of the stone */}
      <Gradient colors={MATERIALS.earth} className={cn('-mt-1 h-3 rounded-t-full', s.mound)} aria-hidden importantForAccessibility="no-hide-descendants" />
    </View>
  );
}

function Moon() {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" className="absolute right-6 top-4 h-16 w-16 items-center justify-center">
      <View className="absolute h-16 w-16 rounded-full" style={{ backgroundColor: MATERIALS.moonGlow }} />
      <View className="h-10 w-10 rounded-full" style={{ backgroundColor: MATERIALS.moon }}>
        <View className="absolute left-2 top-3 h-2 w-2 rounded-full bg-black/10" />
        <View className="absolute bottom-2 right-3 h-1.5 w-1.5 rounded-full bg-black/10" />
      </View>
    </View>
  );
}

/** A band of mist drifting across the bottom of the plot. Still under reduced motion. */
function Fog() {
  const t = useLoop(9000, 0, 0.5);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: (t.value - 0.5) * 80 }] }));
  return (
    <Animated.View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={style}
      className="absolute -left-12 -right-12 bottom-0 h-24">
      <Gradient colors={MATERIALS.fog} className="h-full w-full" />
    </Animated.View>
  );
}
