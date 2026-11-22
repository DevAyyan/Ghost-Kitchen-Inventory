import { Platform, type ImageStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { GHOSTS } from './ghost-sprites';
import { useSimulation } from './haunt-effects';

/**
 * Ghosts, drawn with pixel-art sprites. Each one is physics stepped every frame: its body moves (rising
 * out of spoiled food), leans and squashes on springs, and the sprite turns
 * to face where it's heading and bobs.
 * All of it is smoothed (springs and easing, never jumps), each ghost has its own randomness, and under
 * reduced motion or out of sight the simulation stops and the ghost holds a still pose.
 */

const decorative = { 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants', pointerEvents: 'none' } as const;

const pixelated: ImageStyle = Platform.OS === 'web' ? ({ imageRendering: 'pixelated' } as ImageStyle) : {};

const clamp = (v: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};
/** 0 → 1 with zero slope at both ends: fades that start and finish gently. */
const smooth = (t: number) => {
  'worklet';
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * A pixel-art ghost that reacts to `vx`/`vy` (px/s, the velocity of whatever moves it): it turns to face
 * the way it's drifting (flipping through a squeeze, never snapping) and bobs gently, faster as it speeds up.
 * The parent moves, leans and squashes it. `variant` picks one of the ghost sprites.
 */
export function LivingGhost({ size, vx, vy, variant = 0 }: { size: number; vx: SharedValue<number>; vy: SharedValue<number>; variant?: number }) {
  const face = useSharedValue(1);
  const phase = useSharedValue(Math.random() * Math.PI * 2);

  useSimulation(
    (dt) => {
      'worklet';
      const speed = Math.sqrt(vx.value * vx.value + vy.value * vy.value);
      phase.value += dt * (3 + speed * 0.08);
      // The sprites face left; ease toward the heading so a turn reads as the ghost squeezing round.
      const want = vx.value > 4 ? -1 : vx.value < -4 ? 1 : face.value >= 0 ? 1 : -1;
      face.value += (want - face.value) * Math.min(1, dt * 5);
    },
    () => { face.value = 1; phase.value = 0; }
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: Math.sin(phase.value) * size * 0.04 },
      // Never fully edge-on: a ghost mid-turn is a thin sliver, not invisible.
      { scaleX: face.value >= 0 ? Math.max(0.15, face.value) : Math.min(-0.15, face.value) },
    ],
  }));

  return (
    <Animated.Image
      source={GHOSTS[Math.abs(variant) % GHOSTS.length]}
      fadeDuration={0}
      style={[{ width: size, height: size, resizeMode: 'stretch' }, pixelated, style]}
    />
  );
}

/** How high (px above where it forms) a rising ghost gets before it has faded away. */
const RISE = 34;

/**
 * Spoiled: the food's ghost leaves it. Buoyancy (a little different each time, and pulsing) lifts it
 * against air drag; a smoothly wandering breeze plus the odd gust pushes it sideways while a soft spring
 * keeps it over its food. It leans into its motion and squashes and stretches with acceleration, both
 * on springs. It materialises (fading in and swelling), thins out near the top, then re-forms after a
 * random pause. Still frame: hovering over the food.
 */
export function RisingGhost({ variant = 0 }: { variant?: number }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const vx = useSharedValue((Math.random() - 0.5) * 20);
  const vy = useSharedValue(0);
  const breeze = useSharedValue(0);
  const breezeTarget = useSharedValue(0);
  const lift = useSharedValue(30 + Math.random() * 20);
  const age = useSharedValue(0);
  const lean = useSharedValue(0);
  const leanV = useSharedValue(0);
  const squash = useSharedValue(0);
  const squashV = useSharedValue(0);
  const lastVy = useSharedValue(0);
  // Start part-way through a pause, so ghosts on neighbouring tiles are out of step.
  const pause = useSharedValue(Math.random() * 1.2);
  const fade = useSharedValue(0);

  useSimulation(
    (dt) => {
      'worklet';
      if (pause.value > 0) {
        pause.value -= dt;
        fade.value = 0;
        return;
      }
      age.value += dt;
      // Breeze: a random target that drifts, and the breeze eases toward it (smooth, never jerky).
      breezeTarget.value += (Math.random() - 0.5) * 220 * dt;
      breezeTarget.value -= breezeTarget.value * 0.8 * dt;
      breeze.value += (breezeTarget.value - breeze.value) * Math.min(1, dt * 2.5);
      if (Math.random() < 0.35 * dt) vx.value += (Math.random() - 0.5) * 50; // an occasional gust
      const ax = breeze.value - 6 * x.value;
      const ay = -lift.value * (1 + 0.25 * Math.sin(age.value * 5.5));
      vx.value += (ax - 1.6 * vx.value) * dt;
      vy.value += (ay - 1.6 * vy.value) * dt;
      x.value += vx.value * dt;
      y.value += vy.value * dt;
      // Lean and squash follow on springs, so they flow instead of tracking speed directly.
      leanV.value += (90 * (clamp(vx.value * 0.9, -20, 20) - lean.value) - 10 * leanV.value) * dt;
      lean.value += leanV.value * dt;
      const accel = (vy.value - lastVy.value) / Math.max(dt, 0.001);
      lastVy.value = vy.value;
      // Stretches tall as it speeds up, squats when buoyancy surges, and wobbles back on a spring.
      const shape = clamp(-vy.value * 0.0045 - accel * 0.006, -0.2, 0.25);
      squashV.value += (110 * (shape - squash.value) - 8 * squashV.value) * dt;
      squash.value += squashV.value * dt;
      const height = -y.value / RISE;
      fade.value = smooth(age.value / 0.45) * (1 - smooth((height - 0.62) / 0.38));
      if (height >= 1) {
        x.value = (Math.random() - 0.5) * 10;
        y.value = Math.random() * 3;
        vx.value = (Math.random() - 0.5) * 24;
        vy.value = -Math.random() * 6;
        lastVy.value = vy.value;
        lift.value = 30 + Math.random() * 20;
        breeze.value = 0;
        breezeTarget.value = (Math.random() - 0.5) * 30;
        age.value = 0;
        fade.value = 0;
        pause.value = 0.15 + Math.random() * 1.1;
      }
    },
    () => {
      x.value = 0; y.value = -10; vx.value = 0; vy.value = 0; lean.value = 0; squash.value = 0; age.value = 1; fade.value = 1; pause.value = 0;
    }
  );

  const style = useAnimatedStyle(() => {
    const grow = 0.6 + 0.4 * smooth(age.value / 0.45);
    const s = clamp(squash.value, -0.25, 0.25);
    return {
      opacity: fade.value * 0.95,
      transform: [
        { translateX: x.value },
        { translateY: y.value },
        { rotate: `${lean.value}deg` },
        { scaleX: grow * (1 - s * 0.6) },
        { scaleY: grow * (1 + s) },
      ],
    };
  });
  return (
    // Starts over the photo, so it reads as leaving the food, and floats up past the tile's top edge.
    <Animated.View {...decorative} testID="rising-ghost" style={style} className="absolute left-0 right-0 top-2 z-10 items-center">
      <LivingGhost size={28} vx={vx} vy={vy} variant={variant} />
    </Animated.View>
  );
}
