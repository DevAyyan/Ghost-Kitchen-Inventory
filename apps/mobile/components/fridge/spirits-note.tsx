import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MATERIALS } from '@/lib/theme';
import { DoorClosed, Ghost } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Gradient } from './gradient';
import { useFlicker } from './haunt-effects';

interface FridgeApplianceProps {
  freezer: React.ReactNode;
  fridge: React.ReactNode;
  /** A compartment holding spoiled food is haunted: its lamp flickers and dims. */
  haunted?: { freezer: boolean; fridge: boolean };
}

/**
 * Steel fridge-freezer: freezer compartment over the fridge, feet. Children are the two interiors.
 * No handles on the body: a closed door carries its own, and an open compartment has its close strip.
 */
export function FridgeAppliance({ freezer, fridge, haunted }: FridgeApplianceProps) {
  return (
    <View className="flex-1">
      <Gradient colors={MATERIALS.steel} horizontal className="rounded-xl p-3">
        {/* Rubber door seal around both interiors */}
        <View className="overflow-hidden rounded-lg border-4" style={{ borderColor: MATERIALS.gasket }}>
          <Gradient colors={MATERIALS.freezerInside}>
            <Lamp haunted={!!haunted?.freezer} />
            {freezer}
          </Gradient>
          <Seam />
          <Gradient colors={MATERIALS.fridgeInside}>
            <Lamp haunted={!!haunted?.fridge} />
            {fridge}
          </Gradient>
        </View>
      </Gradient>
      <View aria-hidden className="flex-row justify-between px-8">
        <Foot />
        <Foot />
      </View>
    </View>
  );
}

/**
 * Heading inside a compartment: label on the left, LED thermometer on the right. When something in here
 * has spoiled, says so in words next to the label (the flickering lamp is the visual cue for the same thing).
 */
interface CompartmentHeaderProps {
  label: string;
  temp: string;
  count: number;
  spirits?: number;
  /** Shut this compartment's door. */
  onClose?: () => void;
  /** Move keyboard focus to the Close button (the door was just opened from the keyboard or a tap). */
  focusClose?: boolean;
}

export function CompartmentHeader({ label, temp, count, spirits = 0, onClose, focusClose }: CompartmentHeaderProps) {
  return (
    <View className="flex-row items-center justify-between gap-2 px-3 pt-2">
      <View className="flex-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Text className="text-foreground/80 text-xs font-semibold uppercase tracking-wider">
          {label} <Text className="text-muted-foreground font-normal">· {count}</Text>
        </Text>
        <SpiritsNote count={spirits} />
      </View>
      {/* Hidden on phones, where it squeezed the name onto two lines. The closed door is engraved with it. */}
      <View accessibilityLabel={`Temperature ${temp}`} className="hidden rounded bg-black/70 px-2 py-0.5 sm:flex">
        <Text className="text-primary font-mono text-xs tabular-nums">{temp}</Text>
      </View>
      {onClose && <CloseDoorButton what={label.toLowerCase()} onPress={onClose} focus={focusClose} />}
    </View>
  );
}

/** "Close" in an open compartment's header. 44 px tall like every control. */
export function CloseDoorButton({ what, onPress, focus }: { what: string; onPress: () => void; focus?: boolean }) {
  const ref = React.useRef<View>(null);
  React.useEffect(() => {
    if (!focus) return;
    // Wait for the compartment to stop being inert.
    const id = setTimeout(() => ref.current?.focus?.(), 0);
    return () => clearTimeout(id);
  }, [focus]);
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Close the ${what} door`}
      // Icon-only on phones, where the word pushed the compartment name onto two lines; still 44 px square.
      className="h-11 min-w-11 flex-row items-center justify-center gap-1 rounded-md px-2 active:bg-black/30 web:hover:bg-black/30 web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring">
      <Icon as={DoorClosed} size={16} className="text-foreground/80" />
      <Text className="hidden text-xs font-semibold sm:flex">Close</Text>
    </Pressable>
  );
}

/** "2 spirits in here": spoiled food in a compartment, in words. Renders nothing when there is none. */
export function SpiritsNote({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View className="border-stage-spoiled/50 flex-row items-center gap-1 rounded-full border bg-black/40 px-2 py-0.5">
      <Icon as={Ghost} size={12} className="text-stage-spoiled" />
      <Text className="text-xs">{count === 1 ? '1 spirit in here' : `${count} spirits in here`}</Text>
    </View>
  );
}

function Lamp({ haunted }: { haunted: boolean }) {
  const flicker = useFlicker(haunted);
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" className="absolute inset-x-0 top-0 items-center">
      <Animated.View style={flicker} className="absolute inset-x-0 top-0 items-center">
        <Gradient colors={haunted ? MATERIALS.lampHaunted : MATERIALS.lampGlow} className="absolute inset-x-0 top-0 h-16" />
        <View className="h-1 w-20 rounded-b-full" style={{ backgroundColor: MATERIALS.lamp }} />
      </Animated.View>
    </View>
  );
}

/** The steel door divider between freezer and fridge, with the freezer door's handle. */
function Seam() {
  return (
    <Gradient colors={MATERIALS.steel} horizontal className="h-4 items-center justify-center" aria-hidden importantForAccessibility="no-hide-descendants">
      <Gradient colors={MATERIALS.steelBar} className="h-1.5 w-16 rounded-full" />
    </Gradient>
  );
}

function Foot() {
  return <Gradient colors={MATERIALS.steel} horizontal className="h-2 w-10 rounded-b-md" />;
}
