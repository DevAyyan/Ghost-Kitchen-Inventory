import { Text } from '@/components/ui/text';
import { MATERIALS } from '@/lib/theme';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';
import { SpiritsNote } from './fridge-appliance';
import { Gradient } from './gradient';

interface PantryCabinetProps {
  count: number;
  /** Spoiled items in the pantry. */
  spirits?: number;
  className?: string;
  children: React.ReactNode;
}

/** Wooden pantry cabinet: cornice, framed back panel with plank lines, brass label, kick plate. */
export function PantryCabinet({ count, spirits = 0, className, children }: PantryCabinetProps) {
  return (
    <View className={cn('flex-1', className)}>
      {/* Cornice sticks out a little past the sides, like real cabinet trim */}
      <Gradient colors={MATERIALS.woodPlank} className="-mx-1 h-3 rounded-t-md" aria-hidden importantForAccessibility="no-hide-descendants" />
      <Gradient colors={MATERIALS.woodFrame} horizontal className="px-3 pb-2 pt-2">
        <View className="flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <BrassPlate label="Pantry" count={count} />
            <SpiritsNote count={spirits} />
          </View>
          <Text className="text-muted-foreground text-xs">room temperature</Text>
        </View>
        <Gradient colors={MATERIALS.woodBack} className="rounded-sm border-2" style={{ borderColor: MATERIALS.gasket }}>
          <PlankLines />
          {children}
        </Gradient>
      </Gradient>
      <Gradient colors={MATERIALS.woodFrame} className="mx-1 h-4 rounded-b-sm" aria-hidden importantForAccessibility="no-hide-descendants" />
    </View>
  );
}

function BrassPlate({ label, count }: { label: string; count: number }) {
  return (
    <Gradient colors={MATERIALS.brass} className="rounded px-2 py-0.5">
      <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: MATERIALS.gasket }}>
        {label} · {count}
      </Text>
    </Gradient>
  );
}

/** Faint vertical board joints on the back panel. */
function PlankLines() {
  return (
    <View aria-hidden pointerEvents="none" className="absolute inset-0 flex-row justify-around">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="h-full w-px" style={{ backgroundColor: MATERIALS.woodGrain }} />
      ))}
    </View>
  );
}
