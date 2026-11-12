import { mouldSpots } from '@/lib/domain/haunt';
import { useMotionAllowed } from '@/lib/hooks';
import { MATERIALS } from '@/lib/theme';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * The fridge's "costume". Each effect stands for a state (see lib/domain/haunt.ts and the design contract):
 * glow = expiring, mould + flies = rotting, rising ghost = spoiled, cobweb = forgotten, flickering lamp =
 * something dead in this compartment. All are decorative (the tile's label says the same thing in words)
 * and all stop moving under reduced motion, falling back to a still frame that still reads.
 */

/** A value that loops 0 -> 1 -> 0 forever while motion is allowed; stays at `rest` otherwise. */
export function useLoop(duration: number, delay = 0, rest = 0) {
  const motion = useMotionAllowed();
  const v = useSharedValue(rest);
  React.useEffect(() => {
    if (!motion) {
      cancelAnimation(v);
      v.value = rest;
      return;
    }
    v.value = 0;
    v.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration })), -1)
    );
    return () => cancelAnimation(v);
  }, [motion, duration, delay, rest, v]);
  return v;
}

const decorative = { 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants', pointerEvents: 'none' } as const;

/** Expiring: an ember-coloured ring that breathes. */
export function ExpiringGlow() {
  const t = useLoop(850, 0, 0.6);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + t.value * 0.75 }));
  return (
    <Animated.View
      {...decorative}
      style={style}
      className="border-stage-expiring bg-stage-expiring/10 absolute -inset-1 rounded-lg border-2"
    />
  );
}

/** Rotting: three flies circling the tile. */
export function Flies() {
  return (
    <View {...decorative} className="absolute inset-0">
      <Fly className="left-2 top-2" duration={700} dx={14} dy={-6} />
      <Fly className="right-3 top-5" duration={950} dx={-12} dy={8} delay={200} />
      <Fly className="left-6 top-0" duration={550} dx={8} dy={10} delay={400} />
    </View>
  );
}

function Fly({ className, duration, dx, dy, delay }: { className: string; duration: number; dx: number; dy: number; delay?: number }) {
  const t = useLoop(duration, delay, 0.5);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * dx }, { translateY: t.value * dy }] }));
  return <Animated.View style={style} className={cn('bg-foreground/80 absolute h-1 w-1 rounded-full', className)} />;
}

/** Rotting: mould spots on the photo, more of them the longer it's been past its date. Fills its parent. */
export function Mould({ id, daysOver }: { id: string; daysOver: number }) {
  const spots = React.useMemo(() => mouldSpots(id, daysOver), [id, daysOver]);
  return (
    <View {...decorative} className="absolute inset-0">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {spots.map((s, i) => (
          <React.Fragment key={i}>
            <Circle cx={s.cx} cy={s.cy} r={s.r} fill={MATERIALS.mould[s.tone]} />
            {/* Fuzzy ring + a few spores so it reads as mould, not paint. */}
            <Circle cx={s.cx} cy={s.cy} r={s.r * 1.35} fill="none" stroke={MATERIALS.mould[s.tone]} strokeWidth={1.2} strokeDasharray="1.5 2.5" />
            <Circle cx={s.cx + s.r * 0.9} cy={s.cy - s.r * 0.8} r={1.4} fill={MATERIALS.mould[s.tone]} />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

/** Aging: a faint yellow cast over the photo, like food that's losing its colour. */
export function Yellowing() {
  return <View {...decorative} className="absolute inset-0" style={{ backgroundColor: MATERIALS.yellowing }} />;
}

const GHOST_BODY = 'M12 2C7.6 2 4 5.6 4 10v11l2.7-2 2.6 2 2.7-2 2.7 2 2.6-2L20 21V10c0-4.4-3.6-8-8-8z';

function GhostShape({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={GHOST_BODY} fill={MATERIALS.ghost} />
      <Circle cx={9.2} cy={10} r={1.5} fill={MATERIALS.ghostEye} />
      <Circle cx={14.8} cy={10} r={1.5} fill={MATERIALS.ghostEye} />
      <Path d="M10.4 14.2c.9.7 2.3.7 3.2 0" stroke={MATERIALS.ghostEye} strokeWidth={1.1} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/**
 * Spoiled: the food's ghost leaves it, rising out of the top of the tile and fading, then again.
 * Under reduced motion it just hovers above the tile.
 */
export function RisingGhost() {
  const motion = useMotionAllowed();
  const t = useLoop(1900, 0, 0.45);
  const style = useAnimatedStyle(() => ({
    opacity: motion ? (t.value < 0.15 ? t.value / 0.15 : 1 - (t.value - 0.15) / 0.85) * 0.95 : 0.9,
    transform: [{ translateY: -t.value * 26 }, { translateX: Math.sin(t.value * Math.PI * 2) * 2 }],
  }));
  return (
    // Starts over the photo, so it reads as leaving the food, and floats up past the tile's top edge.
    <Animated.View {...decorative} style={style} className="absolute left-0 right-0 top-2 z-10 items-center">
      <GhostShape size={26} />
    </Animated.View>
  );
}

/** Forgotten: a cobweb across the tile's top corner. */
export function Cobweb({ className }: { className?: string }) {
  return (
    <View {...decorative} className={cn('absolute h-6 w-6', className)}>
      <Svg width="100%" height="100%" viewBox="0 0 24 24">
        <Path
          d="M0 0L24 3M0 0L18 18M0 0L3 24M7 .9Q5.4 5.4.9 7M13.5 1.7Q10 10 1.7 13.5M21 2.6Q15.5 15.5 2.6 21"
          stroke={MATERIALS.cobweb}
          strokeWidth={0.9}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

/**
 * An irregular stutter for the fridge lamp when something in the compartment has died: mostly on,
 * with quick drop-outs. Returns an animated opacity style. Still frame under reduced motion: dim.
 */
export function useFlicker(active: boolean) {
  const motion = useMotionAllowed();
  const v = useSharedValue(1);
  React.useEffect(() => {
    cancelAnimation(v);
    if (!active) { v.value = 1; return; }
    if (!motion) { v.value = 0.45; return; }
    const t = (to: number, duration: number) => withTiming(to, { duration });
    v.value = withRepeat(
      withSequence(t(1, 1400), t(0.2, 50), t(0.9, 70), t(0.3, 60), t(1, 90), t(1, 2300), t(0.5, 80), t(1, 120)),
      -1
    );
    return () => cancelAnimation(v);
  }, [active, motion, v]);
  return useAnimatedStyle(() => ({ opacity: v.value }));
}
