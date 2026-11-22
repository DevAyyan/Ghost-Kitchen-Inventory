import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Pumpkin } from '@/components/halloween/lab-icons';
import { ajarOf, AJAR_FRAME, FRAME_COUNT, GAPS, restFrame, type Ajar, type SceneZone, GHOST_PX, SCENE_ASPECT, SEAM_ROW, SPRITE_H, SPRITE_W, zoomTarget, nightLevel } from '@/lib/domain/kitchen-scene';
import { Art } from '@/components/halloween/art';
import type { Zone } from '@/lib/domain/types';
import { useLayout, useMotionAllowed } from '@/lib/hooks';
import * as React from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { GHOSTS } from './ghost-sprites';
import { BOTH_AJAR, DRIPS, LIGHTS, PANTRY_EYES, SPRITES } from './kitchen-sprites';
import { onTick, pixelated, useFrames, useStutter } from './pixel-effects';
import { sfx } from '@/lib/feedback';
import { useKitchenPulse } from '@/lib/store/kitchen-pulse';

const FRAME_MS = 95;
const ZOOM_MS = 480;
const LAST = FRAME_COUNT - 1;
// Six frames instead of five, so each is a little quicker to keep the swing about as long.

export type DoorPhase = 'idle' | 'opening' | 'zoomIn' | 'inside' | 'zoomOut' | 'closing';

/**
 * One door at a time: play the opening frames, zoom in on the compartment, then show its shelves ("inside").
 * Closing runs the same steps backwards. An ajar door opens from, and closes back to, its ajar frame.
 * Reduced motion skips straight between idle and inside.
 */
export function useKitchenDoor(ajar: Ajar) {
  const motion = useMotionAllowed();
  const [zone, setZone] = React.useState<Zone | null>(null);
  const [phase, setPhase] = React.useState<DoorPhase>('idle');
  const [frame, setFrame] = React.useState(0);
  const zoom = useSharedValue(0);
  const rest = zone ? restFrame(zone, ajar) : 0;

  React.useEffect(() => {
    if (phase === 'opening' || phase === 'closing') {
      const opening = phase === 'opening';
      let f = opening ? rest : LAST;
      setFrame(f);
      const id = setInterval(() => {
        f += opening ? 1 : -1;
        setFrame(f);
        if (f <= rest || f >= LAST) {
          clearInterval(id);
          if (opening) setPhase('zoomIn');
          else { setPhase('idle'); setZone(null); }
        }
      }, FRAME_MS);
      return () => clearInterval(id);
    }
    if (phase === 'zoomIn' || phase === 'zoomOut') {
      const zoomingIn = phase === 'zoomIn';
      zoom.value = withTiming(zoomingIn ? 1 : 0, { duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic) });
      const id = setTimeout(() => setPhase(zoomingIn ? 'inside' : 'closing'), ZOOM_MS);
      return () => clearTimeout(id);
    }
    // `rest` is read when a door starts moving; a stage change mid-swing shouldn't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, zoom]);

  const open = React.useCallback((z: Zone) => {
    setZone(z);
    if (!motion) { zoom.value = 1; setPhase('inside'); return; }
    setPhase('opening');
  }, [motion, zoom]);
  const close = React.useCallback(() => {
    if (!motion) { zoom.value = 0; setPhase('idle'); setZone(null); return; }
    setPhase('zoomOut');
  }, [motion, zoom]);

  /** Inside one compartment, go straight to another: no zoom out and in, the shelves just change. */
  const switchTo = React.useCallback((z: Zone) => { if (phase === 'inside') setZone(z); }, [phase]);

  return { zone, phase, frame, zoom, open, close, switchTo, busy: phase !== 'idle' && phase !== 'inside' };
}

interface KitchenSceneProps {
  zones: Record<Zone, SceneZone>;
  filtered: boolean;
  door: ReturnType<typeof useKitchenDoor>;
  /** Show "Tap to open" under the scene. Dropped once the user has opened doors a few times. */
  hint: boolean;
  canHover: boolean;
  /** Move keyboard focus to this zone's door (it was just closed). */
  focusZone: Zone | null;
  /** Where the scene sits in the window, so the zoom can start from it. */
  onRect: (rect: Rect) => void;
  /** A peeking ghost was tapped: show the most urgent food behind that door. */
  onGhost?: (zone: Zone) => void;
}

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Hit areas as a share of the scene, matching the sprite pixels: each body is 41 of a frame's 78 px wide
 * (so 26.3% of the 156 px scene), the freezer is the top 30 of 79 rows and the fridge the rest.
 */
const SPOTS: Record<Zone, { left: `${number}%`; top: `${number}%`; width: `${number}%`; height: `${number}%` }> = {
  freezer: { left: '0%', top: '0%', width: '26.3%', height: '38%' },
  fridge: { left: '0%', top: '38%', width: '26.3%', height: '62%' },
  pantry: { left: '50%', top: '0%', width: '26.3%', height: '100%' },
};
const ZONES_ORDER: Zone[] = ['freezer', 'fridge', 'pantry'];
const NAMES: Record<Zone, string> = { freezer: 'Freezer', fridge: 'Fridge', pantry: 'Pantry' };
const pct = (n: number) => `${n}%` as const;

/**
 * The fridge-freezer and pantry as pixel art. A door with food turning behind it stands ajar, with a sickly
 * light flickering through the crack and, now and then, a ghost peeking out. Tapping a door plays its
 * opening frames, then the whole scene zooms toward it.
 */
export type { Ajar, SceneZone };

export function KitchenScene({ zones, filtered, door, hint, canHover, focusZone, onRect, onGhost }: KitchenSceneProps) {
  const motion = useMotionAllowed();
  const box = React.useRef<View>(null);
  const { zone, phase, frame } = door;
  const ajar = ajarOf(zones);
  const idle = phase === 'idle';
  const { isPhone } = useLayout();
  const [warm, setWarm] = React.useState<Zone | null>(null);
  const rattle = useRattle(idle);
  // A rattled door shows its crack for a moment, as if something inside pushed it.
  const shown: Ajar = { freezer: ajar.freezer || rattle.freezer, fridge: ajar.fridge || rattle.fridge, pantry: ajar.pantry || rattle.pantry };
  React.useEffect(() => { prefetchSprites(); }, []);
  // How far each door's ghost is out (in sprite pixels). Only ajar doors have one.
  const peek: Record<Zone, number> = {
    freezer: usePeek(1, idle && ajar.freezer),
    fridge: usePeek(2, idle && ajar.fridge),
    pantry: usePeek(3, idle && ajar.pantry),
  };
  // And its ghost has a look at who's there.
  for (const z of ZONES_ORDER) if (rattle[z]) peek[z] = Math.max(peek[z], 8);

  // The overlay zooms from where the scene is now, wherever the page is scrolled to.
  React.useEffect(() => {
    if (phase !== 'zoomIn' && phase !== 'zoomOut') return;
    const id = requestAnimationFrame(() => box.current?.measureInWindow((x, y, w, h) => onRect({ x, y, w, h })));
    return () => cancelAnimationFrame(id);
  }, [phase, onRect]);

  return (
    <View className="gap-2">
      <Animated.View entering={motion && phase !== 'idle' ? FadeIn.duration(160) : undefined}>
        <View
          ref={box}
          collapsable={false}
          className="bg-muted/40 border-border mx-auto w-full max-w-3xl overflow-hidden border-2 border-b-4"
          // The zoom overlay draws the scene while it's zooming out, so this copy waits underneath.
          style={{ aspectRatio: SCENE_ASPECT, opacity: phase === 'zoomOut' ? 0 : 1 }}>
          <Sprites zone={idle ? null : zone} frame={frame} ajar={ajar} pose={shown} live={idle} peek={peek} warm={warm} />
          <NightShade />
          {phase === 'idle' && !isPhone &&
            ZONES_ORDER.map((z) => (
              <Chip key={z} zone={z} info={zones[z]} filtered={filtered} motion={motion} />
            ))}
          {phase === 'idle' &&
            ZONES_ORDER.map((z) => (
              <Hotspot
                key={z}
                zone={z}
                label={zones[z].label}
                onPress={() => door.open(z)}
                onWarm={() => setWarm(z)}
                focus={focusZone === z}
                // The ghost shortcut for screen readers and switch access: same as poking the ghost.
                onUrgent={onGhost && zones[z].haunting > 0 ? () => onGhost(z) : undefined}
              />
            ))}
          {/* Above the doors: a ghost that's well out can be poked. A pointer and touch shortcut only, so
              it stays out of the tab order; the door's own button reaches the same food. */}
          {idle && onGhost &&
            ZONES_ORDER.filter((z) => peek[z] >= 4).map((z) => (
              <GhostButton key={z} zone={z} onPress={() => { sfx('ghost'); onGhost(z); }} />
            ))}
        </View>
      </Animated.View>
      {isPhone && <ChipStrip zones={zones} filtered={filtered} />}
      {hint && phase === 'idle' && (
        <Text className="text-muted-foreground text-center text-xs">{canHover ? 'Click' : 'Tap'} a door to open it</Text>
      )}
    </View>
  );
}

/**
 * Both cabinets. `zone`/`frame`: the door that's moving, if any. Ajar doors rest on frame 1, with their light
 * and the odd peeking ghost while nothing is moving (`live`). While one fridge-freezer door swings, the other
 * keeps its own pose: its half of the sprite is drawn over the moving one, clipped at the seam.
 * Every image stays mounted (only one is visible per layer) so a frame change never waits on loading.
 */
function Sprites({ zone, frame, ajar, pose = ajar, live, peek, warm = null }: {
  zone: Zone | null; frame: number; ajar: Ajar;
  /** Which doors show their crack: the ajar ones, plus any a housemate's change just rattled. */
  pose?: Ajar;
  live: boolean; peek?: Record<Zone, number>;
  /** A door the pointer is on (hover or press): its frames load ahead, so the swing never waits. */
  warm?: Zone | null;
}) {
  const moving = zone === 'freezer' || zone === 'fridge' ? zone : null;
  // Only the images on screen stay mounted, plus every frame of the door that's moving or about to.
  // (All of them at once was about 40 images: fine on web, heavy on a low-end Android phone.)
  const armed = (z: Zone) => zone === z || warm === z;
  // The left body's base image.
  let leftKey: string;
  if (moving) leftKey = `${moving}-${frame}`;
  else if (pose.freezer && pose.fridge) leftKey = 'both';
  else if (pose.freezer) leftKey = `freezer-${AJAR_FRAME}`;
  else if (pose.fridge) leftKey = `fridge-${AJAR_FRAME}`;
  else leftKey = 'fridge-0';
  const pantryFrame = zone === 'pantry' ? frame : restFrame('pantry', pose);
  // Each door's own frame, for its light: the moving door's animation frame, the others' rest pose.
  const frameOf = (z: Zone) => (zone === z ? frame : restFrame(z, ajar));

  const left: [string, number][] = [
    ...SPRITES.fridge.map((src, i) => [`fridge-${i}`, src] as [string, number]),
    ...SPRITES.freezer.map((src, i) => [`freezer-${i}`, src] as [string, number]),
    ['both', BOTH_AJAR],
  ];
  return (
    <>
      <Side side="left">
        {left
          .filter(([key]) => key === leftKey || (key !== 'both' && armed(key.split('-')[0] as Zone)))
          .map(([key, src]) => <Sprite key={key} source={src} shown={key === leftKey} />)}
        {/* The other door holds its ajar pose while one swings. */}
        <SeamClip part="top" shown={moving === 'fridge' && ajar.freezer} source={SPRITES.freezer[AJAR_FRAME]} />
        <SeamClip part="bottom" shown={moving === 'freezer' && ajar.fridge} source={SPRITES.fridge[AJAR_FRAME]} />
        {/* A haunted door's light stays on through the whole swing, open and shut, and in the zoom. */}
        {ajar.freezer && <DoorLight zone="freezer" frame={frameOf('freezer')} all={armed('freezer')} />}
        {ajar.fridge && <DoorLight zone="fridge" frame={frameOf('fridge')} all={armed('fridge')} />}
        {live && <Drip />}
        {live && pose.freezer && <PeekingGhost zone="freezer" seed={1} peek={peek?.freezer ?? 0} />}
        {live && pose.fridge && <PeekingGhost zone="fridge" seed={2} peek={peek?.fridge ?? 0} />}
      </Side>
      <Side side="right">
        {SPRITES.pantry.map((src, i) => (i === pantryFrame || armed('pantry') ? <Sprite key={i} source={src} shown={i === pantryFrame} /> : null))}
        {ajar.pantry && <DoorLight zone="pantry" frame={pantryFrame} all={armed('pantry')} />}
        {live && pose.pantry && <PeekingGhost zone="pantry" seed={3} peek={peek?.pantry ?? 0} />}
        {/* Something watches from the crack, and blinks; it hides while the ghost is out. */}
        {live && ajar.pantry && !(peek?.pantry) && <Eyes />}
      </Side>
    </>
  );
}

/**
 * Web: ask the browser to fetch every sprite once, so mounting a door's frames later is instant. Native
 * assets are bundled files and load from disk.
 */
let prefetched = false;
function prefetchSprites() {
  if (prefetched || Platform.OS !== 'web') return;
  prefetched = true;
  const all = [...Object.values(SPRITES).flat(), BOTH_AJAR, ...Object.values(LIGHTS).flat(), ...DRIPS, PANTRY_EYES];
  for (const src of all) {
    // Expo's web bundler gives bundled images as { uri } (or a URL string); native would need
    // resolveAssetSource, but this only runs on web, where that function doesn't exist.
    const asset = src as unknown as { uri?: string } | string | number | null;
    const uri = typeof asset === 'string' ? asset : asset && typeof asset === 'object' ? asset.uri : null;
    if (uri) void Image.prefetch(uri).catch(() => {});
  }
}

function Side({ side, children }: { side: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" className="absolute inset-y-0 w-1/2" style={side === 'left' ? { left: 0 } : { right: 0 }}>
      {children}
    </View>
  );
}

function Sprite({ source, shown, opacity = 1 }: { source: number; shown: boolean; opacity?: number }) {
  return (
    <Image
      source={source}
      fadeDuration={0}
      // Explicit size: an Image with a bundled asset otherwise takes the file's own 312 x 316 px, not its box.
      style={[StyleSheet.absoluteFill, pixelated, { width: '100%', height: '100%', resizeMode: 'stretch', opacity: shown ? opacity : 0 }]}
    />
  );
}

/** Part of a sprite, cut at the freezer/fridge seam. */
function SeamClip({ part, shown, source }: { part: 'top' | 'bottom'; shown: boolean; source: number }) {
  const rows = part === 'top' ? SEAM_ROW : SPRITE_H - SEAM_ROW;
  const share = (rows / SPRITE_H) * 100;
  return (
    <View className="absolute inset-x-0 overflow-hidden" style={part === 'top' ? { top: 0, height: pct(share) } : { bottom: 0, height: pct(share) }}>
      <Image
        source={source}
        fadeDuration={0}
        style={[pixelated, {
          position: 'absolute', left: 0, width: '100%', height: pct((SPRITE_H / rows) * 100),
          top: part === 'top' ? 0 : pct(-(SEAM_ROW / rows) * 100), resizeMode: 'stretch', opacity: shown ? 1 : 0,
        }]}
      />
    </View>
  );
}

/**
 * The light from a haunted door at its current frame, stuttering now and then. While its door is
 * moving (or about to), every frame's light is mounted, one visible, so the swing never waits. Still frame: steady.
 */
function DoorLight({ zone, frame, all }: { zone: Zone; frame: number; all: boolean }) {
  const level = useStutter(true, 0.35);
  return (
    <>
      {LIGHTS[zone].map((src, i) => (src && (all || i === frame) ? <Sprite key={i} source={src} shown={i === frame} opacity={level} /> : null))}
    </>
  );
}

/**
 * A ghost that every so often slides out from behind an ajar door's edge for a look, a pixel at a time, and
 * ducks back (see usePeek).
 */
function PeekingGhost({ zone, seed, peek }: { zone: Zone; seed: number; peek: number }) {
  const g = GAPS[zone];
  const ghostTop = Math.max(0, Math.round((g.h - GHOST_PX) / 2));
  if (peek <= 0) return null;
  return (
    <View
      className="absolute overflow-hidden"
      style={{ left: pct((g.x / SPRITE_W) * 100), top: pct((g.y / SPRITE_H) * 100), width: pct((g.w / SPRITE_W) * 100), height: pct((g.h / SPRITE_H) * 100) }}>
      <Image
        source={GHOSTS[(seed * 3) % GHOSTS.length]}
        fadeDuration={0}
        style={[pixelated, {
          position: 'absolute', resizeMode: 'stretch',
          left: pct(((g.w - peek) / g.w) * 100), top: pct((ghostTop / g.h) * 100),
          width: pct((GHOST_PX / g.w) * 100), height: pct((GHOST_PX / g.h) * 100),
        }]}
      />
    </View>
  );
}

/** How long a door rattles after a housemate's change. */
const RATTLE_MS = 1600;

/** Doors a housemate's change just touched (see lib/store/kitchen-pulse.ts), for RATTLE_MS. */
function useRattle(idle: boolean): Ajar {
  const { zones, at } = useKitchenPulse();
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    if (!at || !idle || Date.now() - at > RATTLE_MS) return;
    setOn(true);
    const id = setTimeout(() => setOn(false), RATTLE_MS - (Date.now() - at));
    return () => clearTimeout(id);
  }, [at, idle]);
  return { freezer: on && zones.includes('freezer'), fridge: on && zones.includes('fridge'), pantry: on && zones.includes('pantry') };
}

/**
 * How many sprite pixels of a ghost show past the door edge. Mostly 0; every few seconds it creeps out a
 * pixel per step, lingers (sometimes only half out), and slips back. Runs on the shared pixel clock.
 * Off under reduced motion.
 */
function usePeek(seed: number, active: boolean) {
  const motion = useMotionAllowed();
  const [shown, setShown] = React.useState(0);
  React.useEffect(() => {
    if (!motion || !active) { setShown(0); return; }
    let cur = 0;
    let target = 0;
    let mode: 'wait' | 'move' | 'linger' = 'wait';
    let next = Date.now() + 800 + seed * 1300 + Math.random() * 2000;
    return onTick((now) => {
      if (now < next) return;
      if (mode === 'wait') {
        target = Math.random() < 0.3 ? 5 : 9 + Math.floor(Math.random() * 3);
        mode = 'move';
      }
      if (mode === 'move') {
        if (cur !== target) {
          cur += cur < target ? 1 : -1;
          setShown(cur);
          next = now + 55;
          return;
        }
        if (cur > 0) { mode = 'linger'; next = now + 900 + Math.random() * 1800; return; }
        mode = 'wait';
        next = now + 2500 + Math.random() * 6000;
        return;
      }
      // Lingered long enough: slip back in.
      target = 0;
      mode = 'move';
    });
  }, [motion, seed, active]);
  return shown;
}

/** A slime drop falling from the freezer seam now and then: four frames, then a pause. */
function Drip() {
  const f = useFrames(14, 150);
  return <>{DRIPS.map((src, i) => <Sprite key={i} source={src} shown={f === i} />)}</>;
}

/** Red eyes in the pantry's crack. They blink about every 3 seconds. */
function Eyes() {
  const f = useFrames(22, 140);
  return <Sprite source={PANTRY_EYES} shown={f !== 0} />;
}

/** The tappable area over a ghost that's out of its door, matching its window on the sprite. */
function GhostButton({ zone, onPress }: { zone: Zone; onPress: () => void }) {
  const g = GAPS[zone];
  const side = zone === 'pantry' ? 50 : 0;
  return (
    <Pressable
      onPress={onPress}
      testID={`ghost-${zone}`}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      tabIndex={-1}
      focusable={false}
      className="web:cursor-pointer absolute"
      // At least 44 px wide on a phone: the window is narrow, so the button reaches past its left edge.
      style={{
        left: pct(Math.max(0, side + (g.x / SPRITE_W) * 50 - 4)), top: pct((g.y / SPRITE_H) * 100),
        width: pct((g.w / SPRITE_W) * 50 + 4), minWidth: 44, height: pct((g.h / SPRITE_H) * 100),
      }}
    />
  );
}

/**
 * Full-window layer for the zoom. The scene is redrawn at the rect it occupies on the page, then scaled up
 * about its centre and shifted until the open door fills the window; the page fades out behind it. It sits in
 * a Modal so it covers the nav bars on web and Android alike. After zooming in it stays a moment while the
 * shelves fade in underneath, then fades away.
 */
export function ZoomOverlay({ door, rect, ajar }: { door: ReturnType<typeof useKitchenDoor>; rect: Rect | null; ajar: Ajar }) {
  const win = useWindowDimensions();
  const { zone, phase, frame, zoom } = door;
  const [shown, setShown] = React.useState(false);
  const fade = useSharedValue(1);

  React.useEffect(() => {
    if (phase === 'zoomIn' || phase === 'zoomOut') { fade.value = 1; setShown(true); return; }
    if (phase === 'inside') {
      fade.value = withTiming(0, { duration: 240 });
      const id = setTimeout(() => setShown(false), 260);
      return () => clearTimeout(id);
    }
    setShown(false);
  }, [phase, fade]);

  const target = rect && zone ? zoomTarget(zone, rect.w, rect.h, win.width, win.height) : null;
  const camera = useAnimatedStyle(() => {
    if (!rect || !target) return {};
    const s = 1 + (target.scale - 1) * zoom.value;
    // Move the box centre toward the window centre while keeping the region centre under the camera.
    const tx = zoom.value * (win.width / 2 - (rect.x + rect.w / 2)) - s * zoom.value * target.fx;
    const ty = zoom.value * (win.height / 2 - (rect.y + rect.h / 2)) - s * zoom.value * target.fy;
    return { transform: [{ translateX: tx }, { translateY: ty }, { scale: s }] };
  });
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(zoom.value, [0, 0.4], [0, 1], 'clamp') * fade.value }));
  const layer = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!shown) return null;
  return (
    <Modal transparent animationType="none" statusBarTranslucent visible onRequestClose={() => {}}>
      <View className="flex-1" pointerEvents="auto">
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, backdrop]} className="bg-background" />
        {rect && (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h }, layer, camera]}>
            <Sprites zone={zone} frame={frame} ajar={ajar} live={false} />
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

/** What's behind a door, in words: name, count, and why it's ajar. */
function ChipBody({ zone, info, filtered }: { zone: Zone; info: SceneZone; filtered: boolean }) {
  return (
    <>
      <Text className="text-xs font-semibold">{NAMES[zone]}</Text>
      <Text className="text-muted-foreground text-xs">{info.count} {filtered ? (info.count === 1 ? 'match' : 'matches') : info.count === 1 ? 'item' : 'items'}</Text>
      {info.haunting > 0 && (
        <View className="flex-row items-center gap-1">
          <Icon as={Pumpkin} size={12} className="text-stage-expiring" />
          <Text className="text-xs">{info.haunting} haunting</Text>
        </View>
      )}
    </>
  );
}

/** Wide screens: the label sits in the empty space beside the closed body, where the open door will swing. */
function Chip({ zone, info, filtered, motion }: { zone: Zone; info: SceneZone; filtered: boolean; motion: boolean }) {
  const spot = SPOTS[zone];
  const left = zone === 'pantry' ? '77%' : '27.5%';
  return (
    <Animated.View
      entering={motion ? FadeIn.duration(200) : undefined}
      exiting={motion ? FadeOut.duration(100) : undefined}
      pointerEvents="none"
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      className="absolute justify-center"
      style={{ left, top: spot.top, height: spot.height, maxWidth: '22%' }}>
      <View className="bg-background/90 border-border gap-0.5 self-start border-2 px-1.5 py-1">
        <ChipBody zone={zone} info={info} filtered={filtered} />
      </View>
    </Animated.View>
  );
}

/** Phones: the labels sit in a strip under the scene, so they never cover the art. */
function ChipStrip({ zones, filtered }: { zones: Record<Zone, SceneZone>; filtered: boolean }) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" className="flex-row gap-2">
      {ZONES_ORDER.map((z) => (
        <View key={z} className="bg-card border-border flex-1 gap-0.5 border-2 px-2 py-1">
          <ChipBody zone={z} info={zones[z]} filtered={filtered} />
        </View>
      ))}
    </View>
  );
}

function Hotspot({ zone, label, onPress, onWarm, focus, onUrgent }: {
  zone: Zone; label: string; onPress: () => void; onWarm: () => void; focus: boolean; onUrgent?: () => void;
}) {
  const ref = React.useRef<View>(null);
  React.useEffect(() => {
    if (!focus) return;
    const id = setTimeout(() => ref.current?.focus?.(), 0);
    return () => clearTimeout(id);
  }, [focus]);
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      onPressIn={onWarm}
      onHoverIn={onWarm}
      onFocus={onWarm}
      testID={`door-${zone}`}
      accessibilityRole="button"
      // React Native web drops accessibilityHint, so on web the keyboard shortcut goes in the label.
      accessibilityLabel={Platform.OS === 'web' && onUrgent ? `${label} Press U for the most urgent food.` : label}
      accessibilityState={{ expanded: false }}
      aria-expanded={false}
      accessibilityActions={onUrgent ? [{ name: 'urgent', label: 'Show the most urgent food' }] : undefined}
      onAccessibilityAction={onUrgent ? (e) => { if (e.nativeEvent.actionName === 'urgent') onUrgent(); } : undefined}
      accessibilityHint={onUrgent ? 'Has an action to show the most urgent food. On a keyboard, press U.' : undefined}
      // Keyboard: U on a focused door does the same (web only; Pressable's types don't list key events).
      {...(Platform.OS === 'web' && onUrgent
        ? { onKeyDown: (e: { nativeEvent?: { key?: string } }) => { if (e.nativeEvent?.key?.toLowerCase() === 'u') onUrgent(); } }
        : {})}
      className="web:cursor-pointer web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-inset web:focus-visible:ring-ring web:hover:bg-white/10 absolute active:bg-white/10"
      style={SPOTS[zone]}
    />
  );
}

/**
 * Evening and night over the kitchen, by the device's clock: a stepped indigo dusk, then night with the
 * moon in the window corner. Decorative only, so it's hidden from assistive tech and lets taps through.
 * The hour is re-read every 10 minutes, so leaving the app open into the evening darkens it.
 */
function NightShade() {
  const [hour, setHour] = React.useState(() => new Date().getHours());
  React.useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const level = nightLevel(hour);
  if (level === 0) return null;
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18, 10, 48, 1)', opacity: level === 1 ? 0.38 : 0.2 }]} />
      {level === 1 && <View style={{ position: 'absolute', top: '4%', right: '3%' }}><Art name="moon" size={28} /></View>}
      {level === 1 && <NightBat />}
    </View>
  );
}

/** Steps of a bat's flight across the top of the scene: across in jerky pixel hops, flapping up and down. */
const BAT_STEPS = 16;
const BAT_STEP_MS = 140;

/**
 * Atmosphere only: at night a bat crosses the top of the kitchen every half a minute or so. Off under
 * reduced motion, and never over the doors' labels or the ghosts (it keeps to the top tenth).
 */
function NightBat() {
  const motion = useMotionAllowed();
  const [step, setStep] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!motion) return;
    let next = Date.now() + 4_000 + Math.random() * 8_000;
    let start = 0;
    const off = onTick((now) => {
      if (start === 0) {
        if (now < next) return;
        start = now;
      }
      const s = Math.floor((now - start) / BAT_STEP_MS);
      if (s >= BAT_STEPS) {
        setStep(null);
        start = 0;
        next = now + 20_000 + Math.random() * 20_000;
        return;
      }
      setStep(s);
    });
    return off;
  }, [motion]);
  if (step === null) return null;
  const left = 100 - (step / (BAT_STEPS - 1)) * 115;
  return (
    <View style={{ position: 'absolute', top: step % 2 ? '6%' : '3%', left: `${left}%` }}>
      <Art name="bat" size={step % 2 ? 18 : 22} />
    </View>
  );
}
