import { STAGE_ORDER, ZONES } from '@/lib/domain/catalog';
import { daysLeft, stageOf } from '@/lib/domain/expiry';
import type { Item, Zone } from '@/lib/domain/types';
import { useLayout } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { View } from 'react-native';
import { CompartmentHeader, FridgeAppliance } from './fridge-appliance';
import { PantryCabinet } from './pantry-cabinet';
import { type ShelfKind, Shelves } from './shelves';

interface FridgeCabinetProps {
  items: Item[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filtered: boolean;
}

const byUrgency = (a: Item, b: Item) =>
  STAGE_ORDER.indexOf(stageOf(a)) - STAGE_ORDER.indexOf(stageOf(b)) || daysLeft(a) - daysLeft(b);

/**
 * The kitchen: a steel fridge-freezer and a wooden pantry. Three storage sections only, the ones that
 * change shelf life meaningfully (see catalog.ZONES). The pantry stands beside the fridge on wide screens.
 */
export function FridgeCabinet({ items, selectedId, onSelect, filtered }: FridgeCabinetProps) {
  const { width } = useLayout();
  const sideBySide = width >= 1024;

  const shelves = (zone: Zone, kind: ShelfKind, minShelves: number) => (
    <Shelves
      items={items.filter((i) => i.zone === zone).sort(byUrgency)}
      selectedId={selectedId}
      onSelect={onSelect}
      kind={kind}
      minShelves={minShelves}
      filtered={filtered}
    />
  );
  const count = (zone: Zone) => items.filter((i) => i.zone === zone).length;
  const spirits = (zone: Zone) => items.filter((i) => i.zone === zone && stageOf(i) === 'spoiled').length;
  const groupLabel = (name: string, zone: Zone) =>
    `${name}, ${count(zone)} items${spirits(zone) ? `, ${spirits(zone)} spoiled` : ''}`;

  return (
    <View className={cn('gap-6', sideBySide && 'flex-row items-start')}>
      <View role="group" aria-label="Fridge and freezer" className="min-w-0 flex-1">
        <FridgeAppliance
          haunted={{ freezer: spirits('freezer') > 0, fridge: spirits('fridge') > 0 }}
          freezer={
            <View role="group" aria-label={groupLabel('Freezer', 'freezer')}>
              <CompartmentHeader label={ZONES.freezer.label} temp={ZONES.freezer.temp} count={count('freezer')} spirits={spirits('freezer')} />
              {shelves('freezer', 'frost', 1)}
            </View>
          }
          fridge={
            <View role="group" aria-label={groupLabel('Fridge', 'fridge')}>
              <CompartmentHeader label={ZONES.fridge.label} temp={ZONES.fridge.temp} count={count('fridge')} spirits={spirits('fridge')} />
              {shelves('fridge', 'glass', 3)}
            </View>
          }
        />
      </View>
      <View role="group" aria-label={groupLabel('Pantry', 'pantry')} className={sideBySide ? 'w-96' : 'w-full'}>
        <PantryCabinet count={count('pantry')} spirits={spirits('pantry')}>{shelves('pantry', 'wood', 3)}</PantryCabinet>
      </View>
    </View>
  );
}
