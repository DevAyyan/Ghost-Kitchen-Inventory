import { Text } from '@/components/ui/text';
import type { DoorSignals } from '@/lib/domain/haunt';
import { useCanHover, useMotionAllowed } from '@/lib/hooks';
import { MATERIALS } from '@/lib/theme';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, {
  Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { SteelFace, WoodFace } from './door-faces';
import { Magnets, PeekingGhost, SeamLight, SeamSpill } from './door-signals';
import { Gradient } from './gradient';
import { Cobweb, Dormant } from './haunt-effects';

const SWING_MS = 520;

/**
 * Height of a closed, compact door: room for the engraving, a few rows of magnets and the hint. The pantry's
 * magnets share one leaf, so they stack taller.
 */
const COMPACT_HEIGHT = { steel: 144, wood: 176 } as const;

/**
 * Removes a closed compartment from the keyboard's tab order and from clicks on web (`inert`).
 * Android needs nothing extra: importantForAccessibility + pointerEvents cover TalkBack and touch.
 */
function useInert(ref: React.RefObject<View | null>, inert: boolean) {
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = ref.current as unknown as HTMLElement | null;
    el?.toggleAttribute?.('inert', inert);
  }, [ref, inert]);
}

/**
 * A storage compartment: its shelves, and the door over them. The shelves always render, so the
 * compartment keeps its real height (it grows with the food) and the door is drawn to that height.
 * Behind a shut door the food can't be clicked, tabbed to or read out, and its animations rest.
 */
interface CompartmentProps {
  open: boolean;
  door: React.ReactNode;
  /** Shuts the door. Draws a full-height close strip down the compartment's right edge. */
  onClose?: () => void;
  /** "fridge", "freezer", "pantry": for the strip's test id. */
  what?: string;
  kind?: 'steel' | 'wood';
  children: React.ReactNode;
}

/**
 * A shut door shrinks the compartment to a short panel (magnets and handle), so closing a section saves
 * scrolling. It shrinks once the door has swung shut, and grows back to full height as it opens.
 */
export function Compartment({ open, door, onClose, what = 'compartment', kind = 'steel', children }: CompartmentProps) {
  const ref = React.useRef<View>(null);
  const motion = useMotionAllowed();
  useInert(ref, !open);
  const [collapsed, setCollapsed] = React.useState(!open);
  React.useEffect(() => {
    if (open) return setCollapsed(false);
    // Let the leaf finish swinging over the full compartment first.
    const id = setTimeout(() => setCollapsed(true), motion ? SWING_MS : 0);
    return () => clearTimeout(id);
  }, [open, motion]);
  return (
    <View className={cn('relative', collapsed && 'overflow-hidden')} style={collapsed ? { maxHeight: COMPACT_HEIGHT[kind] } : undefined}>
      <View
        ref={ref}
        aria-hidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        pointerEvents={open ? 'auto' : 'none'}
        className="flex-row">
        <View className="min-w-0 flex-1">
          <Dormant.Provider value={!open}>{children}</Dormant.Provider>
        </View>
        {/* Always laid out (even under a shut door) so opening and closing never reflows the shelves. */}
        {onClose && <CloseStrip kind={kind} what={what} onPress={onClose} />}
      </View>
      {door}
    </View>
  );
}

/**
 * A long bar down the right edge of an open compartment: click or tap anywhere on it to shut the door.
 * The header's Close button is the keyboard and screen-reader way to do the same thing, so the strip
 * stays out of the tab order and isn't announced twice. It shows only the handle: the header's Close
 * button already shows the door icon a few pixels away.
 */
function CloseStrip({ kind, what, onPress }: { kind: 'steel' | 'wood'; what: string; onPress: () => void }) {
  const wood = kind === 'wood';
  return (
    <Pressable
      onPress={onPress}
      testID={`close-strip-${what}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      tabIndex={-1}
      focusable={false}
      className="w-11 items-center self-stretch border-l border-black/30 bg-black/20 py-3 active:bg-black/45 web:cursor-pointer web:hover:bg-black/35">
      <Gradient colors={wood ? MATERIALS.brass : MATERIALS.handle} horizontal className="w-2 flex-1 rounded-full" />
    </Pressable>
  );
}

interface StorageDoorProps {
  open: boolean;
  onOpen: () => void;
  /** Spoken label for the closed door, e.g. "Fridge door, closed. 12 items: 2 spoiled… Open it." */
  label: string;
  kind: 'steel' | 'wood';
  signals: DoorSignals;
  /** Engraved on a steel door, e.g. "Fridge · 0–4 °C". */
  title?: string;
  /** Move keyboard focus to the door when it closes (it was closed with the header's Close button). */
  focusOnClose?: boolean;
  /** Show "Tap to open" on the door. Dropped once the user has opened doors a few times. */
  hint?: boolean;
}

/**
 * The door over a compartment. Closed: one big button showing what's inside on the outside. Opening:
 * the leaf (or both pantry leaves) swings on its hinge and fades, then lets clicks through to the food.
 * Reduced motion: opens and closes instantly.
 */
export function StorageDoor({ open, onOpen, label, kind, signals, title, focusOnClose, hint = true }: StorageDoorProps) {
  const motion = useMotionAllowed();
  const canHover = useCanHover();
  const press = React.useRef<View>(null);
  const p = useSharedValue(open ? 1 : 0);

  React.useEffect(() => {
    p.value = motion ? withTiming(open ? 1 : 0, { duration: SWING_MS, easing: Easing.out(Easing.cubic) }) : open ? 1 : 0;
  }, [open, motion, p]);
  React.useEffect(() => {
    if (open || !focusOnClose) return;
    // After the compartment has become inert, or focus would land inside it.
    const id = setTimeout(() => press.current?.focus?.(), 0);
    return () => clearTimeout(id);
  }, [open, focusOnClose]);

  // Gap shadow, ghost, magnets and hints go first, so the leaf is seen swinging over open shelves.
  const early = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.3], [1, 0], Extrapolation.CLAMP) }));
  const wood = kind === 'wood';
  const hintColor = wood ? MATERIALS.engraveOnWood : MATERIALS.engraveOnSteel;

  return (
    <View
      className="absolute inset-0 overflow-hidden"
      pointerEvents={open ? 'none' : 'auto'}
      aria-hidden={open}
      importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}>
      {/* Door art. The button below says all of it in its label, so screen readers skip the art. */}
      <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" className="absolute inset-0">
        {/* The dark gaps around the leaves. Light from expiring food shows only through them. */}
        <Animated.View pointerEvents="none" style={[early, { backgroundColor: MATERIALS.doorGap }]} className="absolute inset-0">
          {signals.expiring && <SeamLight />}
        </Animated.View>

        {wood ? (
          <>
            <Leaf p={p} hinge="left" className="absolute bottom-1.5 left-0 right-1/2 top-0 mr-0.5"><WoodFace knob="right" /></Leaf>
            {signals.spoiled && <Animated.View pointerEvents="none" style={early} className="absolute inset-0"><Dormant.Provider value={open}><PeekingGhost side="center" /></Dormant.Provider></Animated.View>}
            <Leaf p={p} hinge="right" className="absolute bottom-1.5 left-1/2 right-0 top-0 ml-0.5"><WoodFace knob="left" /></Leaf>
          </>
        ) : (
          <>
            <Leaf p={p} hinge="left" className="absolute bottom-1.5 left-0 right-3 top-0"><SteelFace title={title ?? ''} /></Leaf>
            {/* Behind an open door nobody sees it, so its simulation rests. */}
            {signals.spoiled && <Animated.View pointerEvents="none" style={early} className="absolute inset-0"><Dormant.Provider value={open}><PeekingGhost side="right" /></Dormant.Provider></Animated.View>}
          </>
        )}

        <Animated.View pointerEvents="none" style={early} className="absolute inset-0">
          {signals.expiring && <SeamSpill edge={wood ? 'center' : 'right'} />}
          {signals.forgotten > 0 && (
            // Magnets (and the steel engraving) sit top-left, so the web hangs top-right, mirrored: on the
            // right pantry leaf, or by the steel door's opening edge.
            <View
              testID="door-cobweb"
              className={cn('absolute top-0 h-12 w-12', wood ? 'right-0' : 'right-3')}
              style={{ transform: [{ scaleX: -1 }] }}>
              <Cobweb className="inset-0 h-12 w-12" />
            </View>
          )}
          <Magnets signals={signals} className={wood ? 'left-3 right-1/2 top-3 mr-4' : 'left-3 right-10 top-9'} />
          {hint && (
            <Text className="absolute bottom-3 left-3 text-xs font-semibold" style={{ color: hintColor }}>
              {canHover ? 'Click to open' : 'Tap to open'}
            </Text>
          )}
        </Animated.View>
      </View>

      {!open && (
        <Pressable
          ref={press}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: false }}
          aria-expanded={false}
          className="web:cursor-pointer web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-inset web:focus-visible:ring-ring absolute inset-0"
        />
      )}
    </View>
  );
}

/** One door leaf. Hinged on the left it swings toward you to the left; on the right, to the right. */
function Leaf({ p, hinge, className, children }: { p: SharedValue<number>; hinge: 'left' | 'right'; className: string; children: React.ReactNode }) {
  const sign = hinge === 'left' ? -1 : 1;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.7, 1], [1, 1, 0], Extrapolation.CLAMP),
    transform: [{ perspective: 1200 }, { rotateY: `${sign * 95 * p.value}deg` }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ transformOrigin: hinge === 'left' ? 'left center' : 'right center', backfaceVisibility: 'hidden' }, style]}
      className={cn(className)}>
      {children}
    </Animated.View>
  );
}
