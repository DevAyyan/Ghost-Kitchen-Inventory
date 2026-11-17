import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { STAGE_ORDER } from '@/lib/domain/catalog';
import type { DoorSignals } from '@/lib/domain/haunt';
import { MATERIALS } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Gradient } from './gradient';
import { PeekBody, usePeekPhysics } from './ghost';
import { useLoop } from './haunt-effects';

/**
 * What a closed door says about the food behind it (see the "Costume layer" in docs/design-contract.md).
 * Magnets carry the counts in words; the light, ghost and cobwebs repeat the same facts visually, and the
 * door's button label says all of it for screen readers.
 */

/** Hand-placed tilts (degrees), so the set looks stuck on one at a time, and the same on every render. */
const TILTS = [-4, 3, -2, 5, -3];

/**
 * One magnet per stage with food in it: icon + count + word on a chunky, glossy magnet in that stage's
 * colour, never colour alone. Built like the real thing: a coloured body with a highlight across the top,
 * a dark pin "dot" where it meets the door, and a soft shadow under it.
 */
export function Magnets({ signals, className, onLayout }: { signals: DoorSignals; className?: string; onLayout?: (e: LayoutChangeEvent) => void }) {
  const stages = STAGE_ORDER.filter((s) => signals.counts[s] > 0);
  return (
    <View onLayout={onLayout} className={cn('absolute flex-row flex-wrap items-start gap-x-2 gap-y-2.5', className)}>
      {signals.total === 0 ? (
        <Magnet tilt={-3} bodyClass="bg-secondary" label="Empty" />
      ) : (
        stages.map((s, i) => {
          const st = STAGE_STYLE[s];
          return (
            <Magnet
              key={s}
              tilt={TILTS[i % TILTS.length]!}
              bodyClass={st.bg}
              icon={st.icon}
              count={signals.counts[s]}
              label={st.label.toLowerCase()}
            />
          );
        })
      )}
    </View>
  );
}

function Magnet({ tilt, bodyClass, icon, count, label }: { tilt: number; bodyClass: string; icon?: LucideIcon; count?: number; label: string }) {
  const coloured = count !== undefined;
  return (
    <View style={{ transform: [{ rotate: `${tilt}deg` }] }}>
      {/* Shadow on the door, a little below and to the right of the magnet. */}
      <View className="absolute inset-0 translate-x-0.5 translate-y-1 rounded-lg bg-black/45" />
      <View className={cn('flex-row items-center gap-1.5 overflow-hidden rounded-lg border border-black/25 py-1 pl-1.5 pr-2.5', bodyClass)}>
        <Gradient colors={MATERIALS.magnetGloss} className="absolute inset-x-0 top-0 h-1/2" />
        {icon && (
          <View className="h-6 w-6 items-center justify-center rounded-full bg-black/20">
            <Icon as={icon} size={14} className="text-background" />
          </View>
        )}
        {coloured && <Text className="text-background text-lg font-black leading-6 tabular-nums">{count}</Text>}
        <Text className={cn('text-xs font-bold uppercase tracking-wide', coloured ? 'text-background' : 'text-foreground')}>{label}</Text>
      </View>
      {/* The pin dot: where the magnet grips the door. */}
      <View className="absolute -top-1 left-1/2 -ml-1 h-2 w-2 rounded-full border border-black/40 bg-black/50" />
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
