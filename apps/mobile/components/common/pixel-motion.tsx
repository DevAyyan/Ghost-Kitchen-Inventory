import { onTick } from '@/components/fridge/pixel-effects';
import { useMotionAllowed } from '@/lib/hooks';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

/**
 * Small stepped motions for the UI, in the pixel art's style: whole frames on a timer, never a smooth tween.
 * All of them run on the shared clock (onTick), only while playing, and hold their last frame under reduced
 * motion. They move or fade a view; they never change what it says, so nothing is lost without them.
 */
type Frame = { y?: number; x?: number; scale?: number; opacity?: number };

/**
 * Plays `frames`, one every `stepMs`, each time `trigger` changes (and once on mount unless `skipFirst`).
 * Returns the frame to draw. `loop` repeats until unmounted. Without motion it's always the last frame.
 */
export function useSteps(frames: Frame[], stepMs: number, opts: { trigger?: unknown; delayMs?: number; loop?: boolean; skipFirst?: boolean; when?: boolean } = {}): Frame {
  const motion = useMotionAllowed();
  const last = frames.length - 1;
  const [n, setN] = React.useState(() => (motion && !opts.skipFirst ? 0 : last));
  const first = React.useRef(true);
  React.useEffect(() => {
    const skip = first.current && opts.skipFirst;
    first.current = false;
    if (!motion || skip || opts.when === false) { setN(last); return; }
    const start = Date.now() + (opts.delayMs ?? 0);
    setN(0);
    const off = onTick((now) => {
      if (now < start) return;
      const step = Math.floor((now - start) / stepMs);
      if (opts.loop) { setN(step % frames.length); return; }
      setN(Math.min(step, last));
      if (step >= last) off();
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, opts.trigger]);
  return frames[Math.max(0, Math.min(n, last))]!;
}

/**
 * The frame as a style. At rest (no offset, no scale, fully shown) it adds nothing at all: even a do-nothing
 * transform makes browsers draw the text in its own layer (slightly differently), and changes how
 * positioned and layered children behave, so a settled view must be exactly as if it never moved.
 */
const style = (f: Frame) => {
  const moved = (f.x ?? 0) !== 0 || (f.y ?? 0) !== 0 || (f.scale ?? 1) !== 1;
  const faded = (f.opacity ?? 1) !== 1;
  if (!moved && !faded) return undefined;
  return {
    ...(faded ? { opacity: f.opacity } : null),
    ...(moved ? { transform: [{ translateX: f.x ?? 0 }, { translateY: f.y ?? 0 }, { scale: f.scale ?? 1 }] } : null),
  };
};

/** Rises a few pixels into place and solidifies. `index` staggers a list so its rows arrive one by one. */
const RISE: Frame[] = [{ y: 8, opacity: 0 }, { y: 6, opacity: 0.35 }, { y: 2, opacity: 0.7 }, { y: 0, opacity: 1 }];
export function StepIn({ index = 0, trigger, children, ...rest }: ViewProps & { index?: number; trigger?: unknown }) {
  const f = useSteps(RISE, 50, { trigger, delayMs: Math.min(index, 8) * 45 });
  return <View {...rest} style={[rest.style, style(f)]}>{children}</View>;
}

/** A slow two-pixel float, for decorative art (empty-state ghosts, the tour's ghost). */
const FLOAT: Frame[] = [{ y: 0 }, { y: -2 }, { y: -3 }, { y: -2 }, { y: 0 }, { y: 1 }];
export function Bob({ children, ...rest }: ViewProps) {
  const f = useSteps(FLOAT, 260, { loop: true });
  return <View {...rest} style={[rest.style, style(f)]}>{children}</View>;
}

/** A quick hop each time `on` turns true: a tab being selected. Not on first mount. */
const HOP: Frame[] = [{ y: 0 }, { y: -4 }, { y: -6 }, { y: -4 }, { y: 0 }, { y: 1, scale: 1.04 }, { y: 0 }];
export function Hop({ on, children, ...rest }: ViewProps & { on: boolean }) {
  const f = useSteps(HOP, 45, { trigger: on, skipFirst: true, when: on });
  return <View {...rest} style={[rest.style, style(f)]}>{children}</View>;
}

/** A stepped swell when `trigger` changes (a count going up). Not on first mount. */
const SWELL: Frame[] = [{ scale: 1 }, { scale: 1.12 }, { scale: 1.2 }, { scale: 1.08 }, { scale: 1.14 }, { scale: 1 }];
export function Pulse({ trigger, children, ...rest }: ViewProps & { trigger: unknown }) {
  const f = useSteps(SWELL, 60, { trigger, skipFirst: true });
  return <View {...rest} style={[rest.style, style(f)]}>{children}</View>;
}

/** Drops onto a shelf from above with a little bounce: food that just arrived. */
const DROP: Frame[] = [{ y: -18, opacity: 0 }, { y: -12, opacity: 0.6 }, { y: -6 }, { y: 0 }, { y: 2, scale: 1.06 }, { y: 0 }];
export function DropIn({ play, children, ...rest }: ViewProps & { play: boolean }) {
  const f = useSteps(DROP, 55, { trigger: play, skipFirst: !play });
  return <View {...rest} style={[rest.style, play ? style(f) : undefined]}>{children}</View>;
}
