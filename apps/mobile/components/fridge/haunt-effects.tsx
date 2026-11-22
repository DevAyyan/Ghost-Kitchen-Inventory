import { useMotionAllowed } from '@/lib/hooks';
import * as React from 'react';
import {
  Easing, cancelAnimation, useFrameCallback, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';

/**
 * Shared plumbing for the fridge's "costume" (the effects themselves are pixel art, in pixel-effects.tsx and
 * ghost.tsx). Every effect stands for a state (see lib/domain/haunt.ts and the design contract), is
 * decorative, and stops moving under reduced motion, falling back to a still frame that still reads.
 */

/** True where nobody can see the effects (behind a shut door), so they rest. */
export const Dormant = React.createContext(false);

/** Motion is allowed (reduced-motion off) and the effect is visible. */
function useAnimate() {
  return useMotionAllowed() && !React.useContext(Dormant);
}

/** A value that loops 0 -> 1 -> 0 forever while motion is allowed; stays at `rest` otherwise. */
export function useLoop(duration: number, delay = 0, rest = 0) {
  const motion = useAnimate();
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

/**
 * Runs `step(dt)` every frame while the effect is visible and motion is allowed; calls `rest()` and
 * stops otherwise. The physics for ghosts (components/fridge/ghost.tsx) runs on this.
 */
export function useSimulation(step: (dt: number) => void, rest: () => void) {
  const animate = useAnimate();
  const frame = useFrameCallback((f) => {
    'worklet';
    // Clamp so a dropped frame or a background tab doesn't fling the ghost off the screen.
    step(Math.min(0.05, (f.timeSincePreviousFrame ?? 16) / 1000));
  }, false);
  React.useEffect(() => {
    frame.setActive(animate);
    if (!animate) rest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);
}
