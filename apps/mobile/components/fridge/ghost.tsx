import { MATERIALS } from '@/lib/theme';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useSimulation } from './haunt-effects';

/**
 * Ghosts. Each one is two layers of physics stepped every frame:
 * - its body moves (rising out of spoiled food, or peeking out of a door gap), and
 * - its shape reacts to that motion: the hem ripples faster the faster it goes and trails behind it on
 *   its own spring (so it lags, overshoots and settles), it squashes and stretches with acceleration,
 *   its eyes look where it's heading, and it blinks at random.
 * All of it is smoothed (springs and easing, never jumps), each ghost has its own randomness, and under
 * reduced motion or out of sight the simulation stops and the ghost holds a still pose.
 */

const decorative = { 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants', pointerEvents: 'none' } as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

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
 * The body on a 24×24 grid: a round head, sides that lean with `sway`, and a hem of three lobes that
 * ripple (`ripple` deep, travelling with `phase`). Tips trail more than the sides, like cloth.
 */
function ghostBody(phase: number, sway: number, ripple: number): string {
  'worklet';
  const base = 18;
  const f = (n: number) => n.toFixed(2);
  let d = `M4 10A8 8 0 0 1 20 10L${f(20 + sway * 0.7)} ${base}`;
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const x0 = 20 - (16 * (i - 1)) / n;
    const x1 = 20 - (16 * i) / n;
    const wave = Math.sin(phase + i * 1.15) * ripple;
    const lobe = i % 2 === 1;
    d += `Q${f((x0 + x1) / 2 + sway)} ${f(base + (lobe ? 3.4 : -0.4) + wave)} ${f(x1 + sway * 0.7)} ${f(base + wave * 0.45)}`;
  }
  return `${d}Z`;
}
const REST_BODY = ghostBody(0, 0, 0.6);

/** A ghost whose shape reacts to `vx`/`vy` (px/s, the velocity of whatever moves it). */
export function LivingGhost({ size, vx, vy }: { size: number; vx: SharedValue<number>; vy: SharedValue<number> }) {
  const phase = useSharedValue(Math.random() * Math.PI * 2);
  const ripple = useSharedValue(0.6);
  const sway = useSharedValue(0);
  const swayV = useSharedValue(0);
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);
  const lid = useSharedValue(1);
  const nextBlink = useSharedValue(0.8 + Math.random() * 3);
  const blinkAge = useSharedValue(-1);

  useSimulation(
    (dt) => {
      'worklet';
      const speed = Math.sqrt(vx.value * vx.value + vy.value * vy.value);
      phase.value += dt * (3.5 + speed * 0.12);
      ripple.value += (clamp(0.6 + speed * 0.035, 0.6, 2.4) - ripple.value) * Math.min(1, dt * 4);
      // The hem trails behind sideways motion, on a spring of its own.
      const trail = clamp(-vx.value * 0.09, -4, 4);
      swayV.value += (70 * (trail - sway.value) - 7 * swayV.value) * dt;
      sway.value += swayV.value * dt;
      // Eyes lead: they look where it's heading, easing there rather than snapping.
      const k = Math.min(1, dt * 6);
      lookX.value += (clamp(vx.value * 0.045, -1.4, 1.4) - lookX.value) * k;
      lookY.value += (clamp(vy.value * 0.03, -1, 1) - lookY.value) * k;
      // Random blinks, now and then a double blink.
      if (blinkAge.value < 0) {
        nextBlink.value -= dt;
        if (nextBlink.value <= 0) blinkAge.value = 0;
      } else {
        blinkAge.value += dt;
        const t = blinkAge.value / 0.17;
        lid.value = t >= 1 ? 1 : 1 - Math.sin(Math.PI * t) * 0.92;
        if (t >= 1) {
          blinkAge.value = -1;
          nextBlink.value = Math.random() < 0.2 ? 0.22 : 1.6 + Math.random() * 3.4;
        }
      }
    },
    () => {
      phase.value = 0; ripple.value = 0.6; sway.value = 0; swayV.value = 0; lookX.value = 0; lookY.value = 0; lid.value = 1;
    }
  );

  const body = useAnimatedProps(() => ({ d: ghostBody(phase.value, sway.value, ripple.value) }));
  const leftEye = useAnimatedProps(() => ({ cx: 9.2 + lookX.value, cy: 10 + lookY.value, ry: 1.7 * lid.value }));
  const rightEye = useAnimatedProps(() => ({ cx: 14.8 + lookX.value, cy: 10 + lookY.value, ry: 1.7 * lid.value }));
  // Mouth: a small "o" that opens as it speeds up.
  const mouth = useAnimatedProps(() => {
    const speed = Math.sqrt(vx.value * vx.value + vy.value * vy.value);
    return { cx: 12 + lookX.value * 0.8, cy: 14.2 + lookY.value * 0.6, ry: 0.45 + clamp(speed * 0.018, 0, 1.1) };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
      <AnimatedPath animatedProps={body} d={REST_BODY} fill={MATERIALS.ghost} />
      <AnimatedEllipse animatedProps={leftEye} cx={9.2} cy={10} rx={1.35} ry={1.7} fill={MATERIALS.ghostEye} />
      <AnimatedEllipse animatedProps={rightEye} cx={14.8} cy={10} rx={1.35} ry={1.7} fill={MATERIALS.ghostEye} />
      <AnimatedEllipse animatedProps={mouth} cx={12} cy={14.2} rx={0.9} ry={0.45} fill={MATERIALS.ghostEye} />
    </Svg>
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
export function RisingGhost() {
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
      <LivingGhost size={26} vx={vx} vy={vy} />
    </Animated.View>
  );
}

/**
 * A ghost peeking out of a door gap. It sits on an under-damped spring, so it pops out with overshoot
 * and wobble; it ducks back in (and out again) at random moments, sometimes only half-way, bobs on a
 * smooth random drift, and leans and stretches with its motion, both on springs. `hidden`: how far it
 * slides to vanish into the gap. Returns its style and velocity (for LivingGhost).
 */
export function usePeekPhysics(hidden: number) {
  const px = useSharedValue(0);
  const pv = useSharedValue(0);
  const target = useSharedValue(0);
  const timer = useSharedValue(0.5 + Math.random() * 2);
  const py = useSharedValue(0);
  const yv = useSharedValue(0);
  const drift = useSharedValue(0);
  const driftTarget = useSharedValue(0);
  const lean = useSharedValue(0);
  const leanV = useSharedValue(0);

  useSimulation(
    (dt) => {
      'worklet';
      timer.value -= dt;
      if (timer.value <= 0) {
        if (target.value === 0) {
          // Duck back into the gap for a moment.
          target.value = hidden;
          timer.value = 0.3 + Math.random() * 0.8;
        } else {
          // Out again: sometimes a big curious lean, sometimes a cautious half-peek.
          target.value = Math.random() < 0.3 ? hidden * 0.45 : 0;
          timer.value = 1.4 + Math.random() * 3.4;
          pv.value -= 60 + Math.random() * 90; // a kick, so it pops out rather than slides
        }
      }
      pv.value += (110 * (target.value - px.value) - 9 * pv.value) * dt;
      px.value += pv.value * dt;
      driftTarget.value += (Math.random() - 0.5) * 90 * dt;
      driftTarget.value -= driftTarget.value * 1.2 * dt;
      drift.value += (driftTarget.value - drift.value) * Math.min(1, dt * 3);
      yv.value += (drift.value * 6 - 25 * py.value - 4 * yv.value) * dt;
      py.value += yv.value * dt;
      leanV.value += (80 * (clamp(-pv.value * 0.12, -24, 24) - lean.value) - 9 * leanV.value) * dt;
      lean.value += leanV.value * dt;
    },
    () => {
      px.value = 0; pv.value = 0; py.value = 0; yv.value = 0; target.value = 0; lean.value = 0;
    }
  );

  const style = useAnimatedStyle(() => {
    const stretch = 1 + clamp(Math.abs(pv.value) / 700, 0, 0.16);
    return {
      transform: [
        { translateX: px.value },
        { translateY: py.value },
        { rotate: `${lean.value}deg` },
        { scaleX: stretch },
        { scaleY: 1 / stretch },
      ],
    };
  });
  return { style, vx: pv, vy: yv };
}

/** A ghost leaning out of a gap; it never covers more than its clipping window allows. */
export function PeekBody({ size, physics }: { size: number; physics: ReturnType<typeof usePeekPhysics> }) {
  return (
    <Animated.View style={physics.style}>
      <LivingGhost size={size} vx={physics.vx} vy={physics.vy} />
    </Animated.View>
  );
}

