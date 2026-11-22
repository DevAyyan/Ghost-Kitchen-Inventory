import { STAGE_ORDER } from '@/lib/domain/catalog';
import { daysLeft, stageOf } from '@/lib/domain/expiry';
import type { Item, Zone } from '@/lib/domain/types';
import { doorFeedback } from '@/lib/feedback';
import { useCanHover } from '@/lib/hooks';
import { DOOR_HINT_OPENS, useSettings } from '@/lib/store/settings-store';
import * as React from 'react';
import { sceneZones, type Ajar } from '@/lib/domain/kitchen-scene';
import { KitchenScene, useKitchenDoor, type Rect } from './kitchen-scene';

export const byUrgency = (a: Item, b: Item) =>
  STAGE_ORDER.indexOf(stageOf(a)) - STAGE_ORDER.indexOf(stageOf(b)) || daysLeft(a) - daysLeft(b);

/**
 * Door state for the kitchen, kept by the screen: while a compartment is open it takes over the whole page,
 * so the scene and the open view are siblings and neither can own it.
 */
export function useKitchen(ajar: Ajar) {
  const door = useKitchenDoor(ajar);
  const doorOpens = useSettings((s) => s.settings.doorOpens);
  const update = useSettings((s) => s.update);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [justClosed, setJustClosed] = React.useState<Zone | null>(null);
  const { zone, phase } = door;

  // A rect from before a scroll or resize would start the zoom in the wrong place.
  React.useEffect(() => { if (phase === 'opening' || phase === 'inside') setRect(null); }, [phase]);

  const open = React.useCallback((z: Zone) => {
    // Only for doors the user moves, so the sound matches the animation.
    doorFeedback(z, 'open');
    setJustClosed(null);
    if (doorOpens < DOOR_HINT_OPENS) update({ doorOpens: doorOpens + 1 });
    door.open(z);
  }, [door, doorOpens, update]);
  const close = React.useCallback(() => {
    if (!zone || phase !== 'inside') return;
    doorFeedback(zone, 'close');
    setJustClosed(zone);
    door.close();
  }, [door, zone, phase]);

  const switchTo = React.useCallback((z: Zone) => {
    if (z === zone || phase !== 'inside') return;
    doorFeedback(z, 'open');
    door.switchTo(z);
  }, [door, zone, phase]);

  return { door, rect, setRect, open, close, switchTo, justClosed, hint: doorOpens < DOOR_HINT_OPENS };
}

export type Kitchen = ReturnType<typeof useKitchen>;

interface FridgeCabinetProps {
  kitchen: Kitchen;
  /** What's shown on the shelves (after search and stage filters). */
  items: Item[];
  /** Everything stored, for what the doors say on the outside. */
  allItems: Item[];
  filtered: boolean;
  /** Opens an item's details (a poked ghost shows the most urgent food behind its door). */
  onSelect?: (id: string) => void;
}

/**
 * The kitchen: pixel-art fridge-freezer and pantry. Tapping a door plays its opening animation and zooms in,
 * then that compartment's shelves fill the page (OpenCompartment). Close zooms back out and plays it in reverse.
 * Search and stage filters don't open doors: each door shows how many items match.
 */
export function FridgeCabinet({ kitchen, items, allItems, filtered, onSelect }: FridgeCabinetProps) {
  const canHover = useCanHover();
  const { door, open, justClosed, setRect, hint } = kitchen;
  return (
    <KitchenScene
      zones={sceneZones(items, allItems)}
      filtered={filtered}
      door={{ ...door, open }}
      hint={hint}
      canHover={canHover}
      focusZone={door.phase === 'idle' ? justClosed : null}
      onRect={setRect}
      onGhost={onSelect ? (z) => {
        const worst = allItems.filter((i) => i.zone === z).sort(byUrgency)[0];
        if (worst) onSelect(worst.id);
      } : undefined}
    />
  );
}
