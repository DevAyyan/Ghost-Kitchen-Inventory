import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MATERIALS } from '@/lib/theme';
import { Ghost } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Gradient } from './gradient';
import { useFlicker } from './haunt-effects';

interface FridgeApplianceProps {
  freezer: React.ReactNode;
  fridge: React.ReactNode;
  /** A compartment holding spoiled food is haunted: its lamp flickers and dims. */
  haunted?: { freezer: boolean; fridge: boolean };
}

/** Steel fridge-freezer: freezer compartment over the fridge, door handle, feet. Children are the two interiors. */
export function FridgeAppliance({ freezer, fridge, haunted }: FridgeApplianceProps) {
  return (
    <View className="flex-1">
      <Gradient colors={MATERIALS.steel} horizontal className="rounded-xl p-3 pr-5">
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
        <Handle className="top-24" />
        <Handle className="bottom-24" />
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
export function CompartmentHeader({ label, temp, count, spirits = 0 }: { label: string; temp: string; count: number; spirits?: number }) {
  return (
    <View className="flex-row items-center justify-between gap-2 px-3 pt-3">
      <View className="flex-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Text className="text-foreground/80 text-xs font-semibold uppercase tracking-wider">
          {label} <Text className="text-muted-foreground font-normal">· {count}</Text>
        </Text>
        <SpiritsNote count={spirits} />
      </View>
      <View accessibilityLabel={`Temperature ${temp}`} className="rounded bg-black/70 px-2 py-0.5">
        <Text className="text-primary font-mono text-xs tabular-nums">{temp}</Text>
      </View>
    </View>
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

/** A bar handle held off the door by two mounting brackets, so it reads as a handle and not a scrollbar. */
function Handle({ className }: { className: string }) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" className={`absolute right-0 items-end ${className}`}>
      <Gradient colors={MATERIALS.steel} className="h-1.5 w-2.5 rounded-sm" />
      <Gradient colors={MATERIALS.handle} horizontal className="h-20 w-3 rounded-sm" />
      <Gradient colors={MATERIALS.steel} className="h-1.5 w-2.5 rounded-sm" />
    </View>
  );
}

function Foot() {
  return <Gradient colors={MATERIALS.steel} horizontal className="h-2 w-10 rounded-b-md" />;
}
