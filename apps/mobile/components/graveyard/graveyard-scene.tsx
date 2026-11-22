import { FoodPhoto } from '@/components/food/food-photo';
import { Gradient } from '@/components/fridge/gradient';
import { useLoop } from '@/components/fridge/haunt-effects';
import { crisp } from '@/components/fridge/pixel-effects';
import { Art } from '@/components/halloween/art';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/currency/money';
import { useLayout } from '@/lib/hooks';
import { shortDate } from '@/lib/domain/dates';
import { seeded, stoneSize } from '@/lib/domain/haunt';
import type { ItemEvent } from '@/lib/domain/types';
import { MATERIALS } from '@/lib/theme';
import { useApp } from '@/lib/store/app-store';
import { eventPhoto } from '@/lib/store/migrations';
import { FONT_EM, fitLabel } from '@/lib/text-fit';
import { cn } from '@/lib/utils';
import * as React from 'react';
import Svg, { Rect } from 'react-native-svg';
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
 * Phones: one width for every stone, so two stand side by side even at 320 px (2 × 112 + 12 px gap fits
 * the 262 px plot). Height still grows with the money lost, which is what the eye compares.
 */
const PHONE_SIZE = { stone: 'w-28', mound: 'w-28' } as const;
/** The stone widths above in px (w-28 … w-40), for fitting the name. */
const STONE_PX = { phone: 112, sm: 128, md: 144, lg: 160 } as const;

/**
 * Headroom above the engraving, in px, for the cheapest and the costliest grave. Height follows the money
 * lost in proportion (not in three steps), so "the bigger the stone, the more it cost" reads at a glance.
 */
const HEADROOM = { min: 12, max: 96 };

/** A moonlit plot: one tombstone per item thrown away, newest first. */
export function GraveyardScene({ graves }: { graves: ItemEvent[] }) {
  const max = Math.max(0, ...graves.map((g) => g.minor));
  const items = useApp((s) => s.items);
  const { isPhone } = useLayout();
  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  return (
    // Taller on wide screens, with the stones standing on the ground at the bottom of the plot.
    <Gradient colors={MATERIALS.night} className="border-border justify-end rounded-lg border md:min-h-96">
      <Moon />
      <View role="list" className={cn('flex-row flex-wrap items-end justify-center gap-y-6 px-3 pt-16', isPhone ? 'gap-x-3' : 'gap-x-4')}>
        {graves.map((g) => (
          <Tombstone key={g.id} grave={g} photo={eventPhoto(g, byId)} size={stoneSize(g.minor, max)} share={max > 0 ? g.minor / max : 0} compact={isPhone} />
        ))}
      </View>
      <Gradient colors={MATERIALS.earth} className="h-4" aria-hidden importantForAccessibility="no-hide-descendants" />
      <Fog />
    </Gradient>
  );
}

function Tombstone({ grave: g, photo, size, share, compact }: { grave: ItemEvent; photo?: string; size: 'sm' | 'md' | 'lg'; share: number; compact: boolean }) {
  // Stable per grave, so stones don't reshuffle between renders: shape, lean and epitaph.
  const look = React.useMemo(() => {
    const rand = seeded(g.id);
    return {
      arch: rand() > 0.4,
      lean: (rand() - 0.5) * 3,
      epitaph: EPITAPHS[Math.floor(rand() * EPITAPHS.length)],
    };
  }, [g.id]);
  const s = compact ? PHONE_SIZE : SIZE[size];
  const lost = formatMoney(g.minor, g.currency);
  // Sized to the stone so a word never splits mid-way ("Lettuc / e"): the stone's width less padding and border.
  const name = fitLabel(g.name, STONE_PX[compact ? 'phone' : size] - 28, FONT_EM.display, compact ? [20, 18, 16, 14] : [23, 20, 18, 16, 14]);

  return (
    <View
      role="listitem"
      accessible
      accessibilityLabel={`${g.name}, buried ${shortDate(g.date)}, ${lost} lost`}
      className="items-center">
      <View style={{ transform: [{ rotate: `${look.lean}deg` }] }}>
        {look.arch && <PixelArch />}
        <Gradient
          colors={MATERIALS.stone}
          className={cn('items-center gap-1 border-2 px-3 pb-3', s.stone, look.arch && 'border-t-0')}
          style={{ borderColor: MATERIALS.stoneEdge, paddingTop: Math.round(HEADROOM.min + share * (HEADROOM.max - HEADROOM.min)) }}>
          <Text className="font-display text-sm tracking-widest" style={{ color: MATERIALS.stoneText }}>
            R.I.P.
          </Text>
          <FoodPhoto photoUri={photo} category={g.category} name={g.name} stage="spoiled" size="sm" />
          <Text numberOfLines={2} className="font-display text-center" style={{ color: MATERIALS.stoneText, fontSize: name.size, lineHeight: Math.round(name.size * 1.15), fontVariant: ['no-common-ligatures'] }}>
            {name.text}
          </Text>
          <Text className="text-xs tabular-nums" style={{ color: MATERIALS.stoneText, opacity: 0.85 }}>
            {g.purchased ? `${shortDate(g.purchased)} – ` : ''}
            {shortDate(g.date)}
          </Text>
          {/* On a narrow phone stone the epitaph would run to four lines; it's flavour, so it goes. */}
          {!compact && (
            <Text className="text-center text-xs italic" style={{ color: MATERIALS.stoneText, opacity: 0.85 }}>
              “{look.epitaph}”
            </Text>
          )}
          <View className="mt-1 rounded bg-black/40 px-2 py-0.5">
            <Text className="text-destructive text-sm font-semibold tabular-nums">−{lost}</Text>
          </View>
        </Gradient>
      </View>
      {/* Fresh earth in front of the stone */}
      <Gradient colors={MATERIALS.earth} className={cn('-mt-1 h-3', s.mound)} aria-hidden importantForAccessibility="no-hide-descendants" />
    </View>
  );
}

/**
 * A stepped pixel-art arch on top of a stone: rows of blocks, each narrower than the one below, outlined on
 * top in the stone's edge colour.
 */
function PixelArch() {
  const steps = [[4, 8], [2, 12], [1, 14], [0, 16]];
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" className="h-8 w-full">
      <Svg width="100%" height="100%" viewBox="0 0 16 4" preserveAspectRatio="none" {...crisp}>
        {steps.map(([x, w], y) => (
          <React.Fragment key={y}>
            <Rect x={x} y={y} width={w} height={1} fill={MATERIALS.stone[0]} />
            <Rect x={x} y={y} width={w} height={0.4} fill={MATERIALS.stoneEdge} />
            <Rect x={x} y={y} width={0.25} height={1} fill={MATERIALS.stoneEdge} />
            <Rect x={x + w - 0.25} y={y} width={0.25} height={1} fill={MATERIALS.stoneEdge} />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

function Moon() {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" className="absolute right-6 top-4 h-16 w-32 flex-row items-start justify-end">
      {/* Two bats crossing the moon: atmosphere only, so they stay still. */}
      <Art name="bat" size={20} className="mt-1 -rotate-12" />
      <Art name="bat" size={28} className="ml-1 mt-6 rotate-6" />
      <View className="h-16 w-16 items-center justify-center">
        <View className="absolute h-16 w-16 rounded-sm" style={{ backgroundColor: MATERIALS.moonGlow }} />
        <Art name="moon" size={40} />
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
