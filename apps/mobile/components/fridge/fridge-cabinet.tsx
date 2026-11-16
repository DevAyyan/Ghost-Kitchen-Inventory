import { STAGE_ORDER, ZONES } from '@/lib/domain/catalog';
import { daysLeft, stageOf } from '@/lib/domain/expiry';
import { doorSignals, doorSummary } from '@/lib/domain/haunt';
import type { Item, Zone } from '@/lib/domain/types';
import { useLayout } from '@/lib/hooks';
import { doorFeedback } from '@/lib/feedback';
import { DOOR_HINT_OPENS, useSettings } from '@/lib/store/settings-store';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { CompartmentHeader, FridgeAppliance } from './fridge-appliance';
import { PantryCabinet } from './pantry-cabinet';
import { type ShelfKind, Shelves, SHELF_ROW_HEIGHT } from './shelves';
import { Compartment, StorageDoor } from './storage-door';

interface FridgeCabinetProps {
  /** What's shown on the shelves (after search and stage filters). */
  items: Item[];
  /** Everything stored, for what the doors say on the outside. */
  allItems: Item[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filtered: boolean;
  /** Changes whenever the search or stage filter changes. */
  filterKey: string;
  /** Wide screens: shown under the pantry, which is much shorter than the fridge beside it. */
  belowPantry?: React.ReactNode;
}

const byUrgency = (a: Item, b: Item) =>
  STAGE_ORDER.indexOf(stageOf(a)) - STAGE_ORDER.indexOf(stageOf(b)) || daysLeft(a) - daysLeft(b);

/**
 * Wide screens cap each compartment and scroll inside it, so the fridge stays a steady size. Phones let
 * it grow with the food instead: a scroll area inside a scrolling page is fiddly on touch.
 */
const CAP_ROWS: Record<Zone, number> = { freezer: 2, fridge: 4, pantry: 4 };

type Focus = { zone: Zone; to: 'door' | 'close' } | null;

/**
 * The kitchen: a steel fridge-freezer and a wooden pantry, each section behind its own door. Doors start
 * open and remember what you leave shut. A search or stage filter opens the doors with matches (and shuts
 * the rest) without changing what's remembered. The pantry stands beside the fridge on wide screens.
 */
export function FridgeCabinet({ items, allItems, selectedId, onSelect, filtered, filterKey, belowPantry }: FridgeCabinetProps) {
  const { width } = useLayout();
  const sideBySide = width >= 1024;
  const closed = useSettings((s) => s.settings.doorsClosed);
  const doorOpens = useSettings((s) => s.settings.doorOpens);
  const update = useSettings((s) => s.update);
  // While filtering, doors follow the matches; opening or shutting one only lasts until the filter changes.
  const [override, setOverride] = React.useState<Partial<Record<Zone, boolean>>>({});
  const [focus, setFocus] = React.useState<Focus>(null);
  React.useEffect(() => setOverride({}), [filterKey]);

  const inZone = (zone: Zone) => items.filter((i) => i.zone === zone);
  const count = (zone: Zone) => inZone(zone).length;
  const spirits = (zone: Zone) => inZone(zone).filter((i) => stageOf(i) === 'spoiled').length;
  const isOpen = (zone: Zone) => override[zone] ?? (filtered ? count(zone) > 0 : !closed.includes(zone));
  const setOpen = (zone: Zone, open: boolean) => {
    // Only for doors the user moves. Doors that follow a search or filter open silently.
    doorFeedback(zone, open ? 'open' : 'close');
    setFocus({ zone, to: open ? 'close' : 'door' });
    const learned = open && doorOpens < DOOR_HINT_OPENS ? { doorOpens: doorOpens + 1 } : {};
    if (filtered) {
      setOverride((o) => ({ ...o, [zone]: open }));
      if (open) update(learned);
    } else {
      update({ ...learned, doorsClosed: open ? closed.filter((z) => z !== zone) : [...closed.filter((z) => z !== zone), zone] });
    }
  };

  const groupLabel = (zone: Zone) =>
    `${ZONES[zone].label}, ${count(zone)} items${spirits(zone) ? `, ${spirits(zone)} spoiled` : ''}${isOpen(zone) ? '' : ', door closed'}`;

  const shelves = (zone: Zone, kind: ShelfKind, minShelves: number) => {
    const list = (
      <Shelves items={inZone(zone).sort(byUrgency)} selectedId={selectedId} onSelect={onSelect} kind={kind} minShelves={minShelves} filtered={filtered} />
    );
    if (!sideBySide) return list;
    return (
      <ScrollView style={{ maxHeight: CAP_ROWS[zone] * SHELF_ROW_HEIGHT }} nestedScrollEnabled>
        {list}
      </ScrollView>
    );
  };

  const door = (zone: Zone, kind: 'steel' | 'wood') => {
    const signals = doorSignals(allItems.filter((i) => i.zone === zone));
    return (
      <StorageDoor
        open={isOpen(zone)}
        onOpen={() => setOpen(zone, true)}
        kind={kind}
        signals={signals}
        title={`${ZONES[zone].label} · ${ZONES[zone].temp}`}
        label={`${ZONES[zone].label} door, closed. ${doorSummary(signals)}. Open it.`}
        focusOnClose={focus?.zone === zone && focus.to === 'door'}
        hint={doorOpens < DOOR_HINT_OPENS}
      />
    );
  };

  const compartment = (zone: 'freezer' | 'fridge', kind: ShelfKind, minShelves: number) => (
    <Compartment open={isOpen(zone)} door={door(zone, 'steel')} onClose={() => setOpen(zone, false)} what={zone} kind="steel">
      <View role="group" aria-label={groupLabel(zone)}>
        <CompartmentHeader
          label={ZONES[zone].label}
          temp={ZONES[zone].temp}
          count={count(zone)}
          spirits={spirits(zone)}
          onClose={() => setOpen(zone, false)}
          focusClose={focus?.zone === zone && focus.to === 'close'}
        />
        {shelves(zone, kind, minShelves)}
      </View>
    </Compartment>
  );

  return (
    <View className={cn('gap-6', sideBySide && 'flex-row items-start')}>
      <View role="group" aria-label="Fridge and freezer" className="min-w-0 flex-1">
        <FridgeAppliance
          // The lamp only flickers where you can see it.
          haunted={{ freezer: spirits('freezer') > 0 && isOpen('freezer'), fridge: spirits('fridge') > 0 && isOpen('fridge') }}
          freezer={compartment('freezer', 'frost', 1)}
          fridge={compartment('fridge', 'glass', 3)}
        />
      </View>
      <View className={cn('gap-6', sideBySide ? 'w-96' : 'w-full')}>
      <View role="group" aria-label={groupLabel('pantry')}>
        <PantryCabinet
          count={count('pantry')}
          spirits={spirits('pantry')}
          open={isOpen('pantry')}
          onClose={() => setOpen('pantry', false)}
          focusClose={focus?.zone === 'pantry' && focus.to === 'close'}
          door={door('pantry', 'wood')}>
          {shelves('pantry', 'wood', 3)}
        </PantryCabinet>
      </View>
      {sideBySide && belowPantry}
      </View>
    </View>
  );
}
