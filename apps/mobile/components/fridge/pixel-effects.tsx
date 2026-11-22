import { mouldSpots } from '@/lib/domain/haunt';
import { useMotionAllowed } from '@/lib/hooks';
import { MATERIALS } from '@/lib/theme';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Image, Platform, View, type ImageStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Dormant } from './haunt-effects';

/**
 * Pixel-art effects. Motion here is stepped (a few fixed levels or frames, switched on a timer) rather than
 * smoothly tweened, the way sprite animation works. Under reduced motion, or behind a shut door, each one
 * holds a still frame.
 */

const decorative = { 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants', pointerEvents: 'none' } as const;
export const pixelated: ImageStyle = Platform.OS === 'web' ? ({ imageRendering: 'pixelated' } as ImageStyle) : {};
/**
 * Hard pixel edges for SVG. Web only: it's an SVG attribute browsers honour, and on Android react-native-svg
 * would pass it to a native view that doesn't know it. The shapes sit on whole cells either way.
 */
export const crisp: object = Platform.OS === 'web' ? { shapeRendering: 'crispEdges' } : {};

const PX = {
  cobwebSmall: require('@/assets/sprites/pixel/cobweb-small.png'),
  cobwebLarge: require('@/assets/sprites/pixel/cobweb-large.png'),
  dust: require('@/assets/sprites/pixel/dust.png'),
  aging: require('@/assets/sprites/pixel/aging.png'),
  ember: [
    require('@/assets/sprites/pixel/ember-0.png'),
    require('@/assets/sprites/pixel/ember-1.png'),
    require('@/assets/sprites/pixel/ember-2.png'),
  ],
  wall: {
    fridge: require('@/assets/sprites/pixel/wall-fridge.png'),
    freezer: require('@/assets/sprites/pixel/wall-freezer.png'),
    pantry: require('@/assets/sprites/pixel/wall-pantry.png'),
  },
  shelfShadow: require('@/assets/sprites/pixel/shelf-shadow.png'),
};
export { PX };

function useLive() {
  return useMotionAllowed() && !React.useContext(Dormant);
}

/**
 * One shared clock for every stepped pixel effect. A full fridge can show dozens of flames, flies, lights and
 * ghosts; with a timer each they cost battery on Android. Instead one interval runs while anything listens,
 * and each effect works out its own state from the time. Effects only re-render when their frame changes.
 */
const TICK_MS = 40;
const listeners = new Set<(now: number) => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

export function onTick(listener: (now: number) => void) {
  listeners.add(listener);
  if (!ticker) ticker = setInterval(() => { const now = Date.now(); listeners.forEach((l) => l(now)); }, TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && ticker) { clearInterval(ticker); ticker = null; }
  };
}

const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/**
 * A light that mostly burns steadily and now and then stutters: a burst of quick drop-outs, then steady again.
 * `rate` is how often a burst comes (about every 1/rate seconds). Returns the brightness, one of a few steps.
 * Still frame: steady at `rest`.
 */
export function useStutter(active: boolean, rate = 0.3, rest = 1) {
  const live = useLive();
  const [level, setLevel] = React.useState(rest);
  React.useEffect(() => {
    if (!active || !live) { setLevel(rest); return; }
    setLevel(1);
    let next = Date.now() + between(0.5, 1.5) / rate * 1000;
    let left = 0; // drop-outs still to come in this burst
    let dim = false;
    return onTick((now) => {
      if (now < next) return;
      if (!dim && left === 0) {
        left = 2 + Math.floor(Math.random() * 4);
      }
      if (!dim) {
        dim = true;
        left -= 1;
        setLevel([0.15, 0.4, 0.6][Math.floor(Math.random() * 3)]);
        next = now + between(50, 140);
      } else {
        dim = false;
        setLevel(1);
        next = now + (left > 0 ? between(40, 130) : between(0.5, 1.5) / rate * 1000);
      }
    });
  }, [active, live, rate, rest]);
  return level;
}

/** Cycles 0..count-1 every `ms` while live (each user out of step with the others); holds 0 otherwise. */
export function useFrames(count: number, ms: number) {
  const live = useLive();
  const [f, setF] = React.useState(0);
  const offset = React.useRef(Math.random() * ms * count).current;
  React.useEffect(() => {
    if (!live) { setF(0); return; }
    let last = -1;
    return onTick((now) => {
      const frame = Math.floor((now + offset) / ms) % count;
      if (frame !== last) { last = frame; setF(frame); }
    });
  }, [live, count, ms, offset]);
  return f;
}

/** A pixel texture repeated across its parent. */
export function PixelTexture({ source, className, opacity }: { source: number; className?: string; opacity?: number }) {
  return (
    <Image
      {...decorative}
      source={source}
      resizeMode="repeat"
      fadeDuration={0}
      className={cn('absolute inset-0', className)}
      style={[{ width: '100%', height: '100%', opacity }, pixelated]}
    />
  );
}

/** A corner cobweb sprite. `corner` picks which corner it hangs in (it's drawn for the top-left). */
export function PixelCobweb({ big, corner = 'tl', size }: { big?: boolean; corner?: 'tl' | 'tr'; size: number }) {
  // Sways a pixel in a draught, now and then.
  const f = useFrames(6, 500);
  const sway = f === 2 ? 1 : f === 3 ? 2 : f === 4 ? 1 : 0;
  return (
    <Image
      {...decorative}
      source={big ? PX.cobwebLarge : PX.cobwebSmall}
      fadeDuration={0}
      style={[
        { position: 'absolute', top: 0, width: size, height: size, resizeMode: 'stretch' },
        corner === 'tl' ? { left: 0, transform: [{ translateY: sway }] } : { right: 0, transform: [{ scaleX: -1 }, { translateY: sway }] },
        pixelated,
      ]}
    />
  );
}

/** Expiring: pixel flames licking up the bottom edge, three frames on a loop. Still frame: the first. */
export function EmberStrip() {
  const f = useFrames(3, 140);
  return (
    <View {...decorative} className="absolute inset-x-0 bottom-0 h-4 overflow-hidden">
      {PX.ember.map((src, i) => (
        <Image key={i} source={src} resizeMode="repeat" fadeDuration={0} style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 16, width: '100%', opacity: i === f ? 1 : 0 }, pixelated]} />
      ))}
    </View>
  );
}

/** Expiring: the tile's edge blinks between bright and dim in steps, like a warning light. */
export function EmberEdge() {
  const f = useFrames(2, 450);
  return <View {...decorative} className={cn('border-stage-expiring absolute -inset-1 border-2', f === 1 && 'opacity-40')} />;
}

/** Rotting: mould as blocky pixel blotches, more of them the longer it's been past its date. Fills its parent. */
export function PixelMould({ id, daysOver }: { id: string; daysOver: number }) {
  const cells = React.useMemo(() => {
    const out: { x: number; y: number; tone: number }[] = [];
    const N = 16;
    for (const s of mouldSpots(id, daysOver)) {
      for (let gy = 0; gy < N; gy++) {
        for (let gx = 0; gx < N; gx++) {
          const cx = (gx + 0.5) * (100 / N);
          const cy = (gy + 0.5) * (100 / N);
          const d = Math.hypot(cx - s.cx, cy - s.cy);
          // Solid core, then a ragged checkered fringe.
          if (d <= s.r || (d <= s.r * 1.5 && (gx + gy) % 2 === 0)) out.push({ x: gx, y: gy, tone: s.tone });
        }
      }
    }
    return out;
  }, [id, daysOver]);
  return (
    <View {...decorative} className="absolute inset-0">
      <Svg width="100%" height="100%" viewBox="0 0 16 16" preserveAspectRatio="none" {...crisp}>
        {cells.map((c, i) => (
          <Rect key={i} x={c.x} y={c.y} width={1} height={1} fill={MATERIALS.mould[c.tone]} />
        ))}
      </Svg>
    </View>
  );
}

/** Rotting: flies buzzing round the tile, hopping a pixel at a time. */
export function PixelFlies() {
  const f = useFrames(4, 120);
  const path = [[0, 0], [2, -2], [4, 0], [2, 2]];
  const flies = [{ l: 6, t: 6, o: 0 }, { l: 38, t: 14, o: 1 }, { l: 22, t: 2, o: 2 }];
  return (
    <View {...decorative} className="absolute inset-0">
      {flies.map((fl, i) => {
        const [dx, dy] = path[(f + fl.o) % 4];
        return <View key={i} className="bg-foreground absolute h-1 w-1" style={{ left: fl.l + dx, top: fl.t + dy }} />;
      })}
    </View>
  );
}

/**
 * The lamp at the top of an open fridge or freezer: a pixel bar and a stepped cone of light under it. It
 * flickers now and then; more often, and colder, when something inside has died.
 */
export function PixelLamp({ haunted }: { haunted: boolean }) {
  const level = useStutter(true, haunted ? 0.6 : 0.15, 1);
  const rows = 9;
  return (
    <View {...decorative} className="absolute inset-x-0 top-0 items-center" style={{ opacity: level }}>
      <View className="h-1.5 w-24" style={{ backgroundColor: MATERIALS.lamp }} />
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          className="h-3"
          style={{
            width: `${34 + i * 7}%`,
            backgroundColor: haunted ? 'hsla(200, 40%, 80%, 1)' : 'hsla(120, 60%, 88%, 1)',
            opacity: (haunted ? 0.1 : 0.16) * (1 - i / rows),
          }}
        />
      ))}
    </View>
  );
}
