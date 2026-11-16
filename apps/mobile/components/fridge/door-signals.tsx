import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { STAGE_ORDER } from '@/lib/domain/catalog';
import type { DoorSignals } from '@/lib/domain/haunt';
import { MATERIALS } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Gradient } from './gradient';
import { PeekBody, usePeekPhysics } from './ghost';
import { useLoop } from './haunt-effects';

/**
 * What a closed door says about the food behind it (see the "Costume layer" in docs/design-contract.md).
 * Magnets carry the counts in words; the light, ghost and cobwebs repeat the same facts visually, and the
 * door's button label says all of it for screen readers.
 */

/** One magnet per stage with food in it: icon + count + word, never colour alone. */
export function Magnets({ signals, className }: { signals: DoorSignals; className?: string }) {
  const stages = STAGE_ORDER.filter((s) => signals.counts[s] > 0);
  return (
    <View className={cn('absolute flex-row flex-wrap gap-1.5', className)}>
      {signals.total === 0 ? (
        <View className="border-border bg-card rounded-full border px-2 py-0.5">
          <Text className="text-xs">Empty</Text>
        </View>
      ) : (
        stages.map((s, i) => {
          const st = STAGE_STYLE[s];
          return (
            <View
              key={s}
              // A slight, fixed tilt: stuck on by hand, the same every render.
              style={{ transform: [{ rotate: `${i % 2 ? 2 : -2}deg` }] }}
              className={cn('bg-card flex-row items-center gap-1 rounded-full border px-2 py-0.5', st.border)}>
              <Icon as={st.icon} size={12} className={st.text} />
              <Text className="text-xs font-semibold tabular-nums">
                {signals.counts[s]} {st.label.toLowerCase()}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

/**
 * Expiring: warm light inside the compartment. Drawn behind the door, so it only shows through the gaps
 * around it, breathing slowly. Still (but lit) under reduced motion.
 */
export function SeamLight() {
  const t = useLoop(1400, 0, 0.5);
  const style = useAnimatedStyle(() => ({ opacity: 0.4 + t.value * 0.6 }));
  return <Animated.View testID="door-ember" style={[style, { backgroundColor: MATERIALS.ember }]} className="absolute inset-0" />;
}

/** The same light spilling a little onto the door face next to the seams. `edge`: where the door opens. */
export function SeamSpill({ edge }: { edge: 'right' | 'center' }) {
  const t = useLoop(1400, 0, 0.7);
  const style = useAnimatedStyle(() => ({ opacity: 0.4 + t.value * 0.6 }));
  return (
    <Animated.View style={style} className="absolute inset-0">
      <Gradient colors={MATERIALS.emberSpill} className="absolute inset-x-0 bottom-0 h-10" />
      {edge === 'right' ? (
        <Gradient colors={MATERIALS.emberSpill} horizontal className="absolute bottom-0 right-3 top-0 w-8" />
      ) : (
        <>
          <Gradient colors={MATERIALS.emberSpill} horizontal className="absolute bottom-0 right-1/2 top-0 w-6" />
          <Gradient colors={[MATERIALS.emberSpill[1], MATERIALS.emberSpill[0]]} horizontal className="absolute bottom-0 left-1/2 top-0 w-6" />
        </>
      )}
    </Animated.View>
  );
}

/**
 * Spoiled: a ghost peeking out of the door gap, ducking back now and then. Rendered behind the door leaf
 * it peeks from, so the leaf hides most of it. `side`: the fridge's right-hand gap, or the pantry's centre.
 */
export function PeekingGhost({ side }: { side: 'right' | 'center' }) {
  const physics = usePeekPhysics(24);
  if (side === 'right') {
    // Drawn over the leaf's opening edge inside a clipping window, so it reads as leaning out of the gap
    // (a 12 px gap alone is too narrow to show a face).
    return (
      <View testID="door-ghost" className="absolute right-0 h-11 w-9 overflow-hidden" style={{ top: '30%' }}>
        <View className="absolute left-1 top-1.5">
          <PeekBody size={32} physics={physics} />
        </View>
      </View>
    );
  }
  return (
    <View testID="door-ghost" style={{ left: '50%', marginLeft: -24, top: '28%' }} className="absolute">
      <PeekBody size={32} physics={physics} />
    </View>
  );
}
