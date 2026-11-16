import { Text } from '@/components/ui/text';
import { MATERIALS } from '@/lib/theme';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';
import { CloseDoorButton, SpiritsNote } from './fridge-appliance';
import { Gradient } from './gradient';
import { Compartment } from './storage-door';

interface PantryCabinetProps {
  count: number;
  /** Spoiled items in the pantry. */
  spirits?: number;
  open: boolean;
  onClose: () => void;
  focusClose?: boolean;
  /** The double doors over the shelves (a StorageDoor). */
  door: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Wooden pantry cabinet: cornice, brass label, double doors over a framed back panel, kick plate. */
export function PantryCabinet({ count, spirits = 0, open, onClose, focusClose, door, className, children }: PantryCabinetProps) {
  return (
    <View className={cn('flex-1', className)}>
      {/* Cornice sticks out a little past the sides, like real cabinet trim */}
      <Gradient colors={MATERIALS.woodPlank} className="-mx-1 h-3 rounded-t-md" aria-hidden importantForAccessibility="no-hide-descendants" />
      <Gradient colors={MATERIALS.woodFrame} horizontal className="px-3 pb-2 pt-2">
        <View className="min-h-11 flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <BrassPlate label="Pantry" count={count} />
            {open && <SpiritsNote count={spirits} />}
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-muted-foreground text-xs">room temperature</Text>
            {open && <CloseDoorButton what="pantry" onPress={onClose} focus={focusClose} />}
          </View>
        </View>
        <Gradient colors={MATERIALS.woodBack} className="rounded-sm border-2" style={{ borderColor: MATERIALS.gasket }}>
          <Compartment open={open} door={door} onClose={onClose} what="pantry" kind="wood">
            <PlankLines />
            {children}
          </Compartment>
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
