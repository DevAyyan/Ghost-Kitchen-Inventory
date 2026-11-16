import { Text } from '@/components/ui/text';
import type { Item } from '@/lib/domain/types';
import { useCanHover, useLayout } from '@/lib/hooks';
import { MATERIALS } from '@/lib/theme';
import * as React from 'react';
import { View } from 'react-native';
import { FoodTile, TILE_GAP, tileWidth } from './food-tile';
import { Gradient } from './gradient';

export type ShelfKind = 'glass' | 'frost' | 'wood';

interface ShelvesProps {
  items: Item[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  kind: ShelfKind;
  /** Shelves drawn even when empty, so an empty fridge still looks like a fridge. */
  minShelves: number;
  /** True when a filter or search is active (changes the empty message). */
  filtered: boolean;
}

/**
 * Splits items into rows that fit the measured width, each row standing on its own shelf. Tiles then
 * stretch to share the row's spare width (so names get more room), up to MAX_STRETCH of their base size.
 */
export function Shelves({ items, selectedId, onSelect, kind, minShelves, filtered }: ShelvesProps) {
  const { isPhone } = useLayout();
  const canHover = useCanHover();
  const [width, setWidth] = React.useState(0);
  const base = tileWidth(isPhone);
  const perRow = width === 0 ? 4 : Math.max(1, Math.floor((width - ROW_PADDING + TILE_GAP) / (base + TILE_GAP)));
  const fill = width === 0 ? base : Math.floor((width - ROW_PADDING - TILE_GAP * (perRow - 1)) / perRow);
  const tileW = Math.max(base, Math.min(fill, Math.round(base * MAX_STRETCH)));

  const rows: Item[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  while (rows.length < minShelves) rows.push([]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {rows.map((row, idx) => (
        <View key={idx}>
          <View className="min-h-32 flex-row items-end gap-3 px-3 pt-4">
            {row.length ? (
              row.map((i) => <FoodTile key={i.id} item={i} selected={i.id === selectedId} onPress={onSelect} hoverCard={canHover} width={tileW} />)
            ) : idx === 0 ? (
              <Text className="text-muted-foreground self-center pb-4 text-xs italic">
                {filtered ? 'Nothing matches here' : 'Empty'}
              </Text>
            ) : null}
          </View>
          <ShelfSurface kind={kind} />
        </View>
      ))}
    </View>
  );
}

const ROW_PADDING = 24; // px-3 on both sides
/** Tiles never grow past this multiple of their base width, so a sparse wide shelf doesn't get giant tiles. */
const MAX_STRETCH = 1.5;
/** Height of one shelf row (tile + `pt-4` + the shelf board and its shadow), for capping compartments. */
export const SHELF_ROW_HEIGHT = 148;

/** The board the items stand on, plus the soft shadow it casts on whatever is below. */
function ShelfSurface({ kind }: { kind: ShelfKind }) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants">
      {kind === 'wood' ? (
        <Gradient colors={MATERIALS.woodPlank} className="mx-1 h-3 rounded-sm">
          <View className="absolute inset-x-0 top-1 h-px" style={{ backgroundColor: MATERIALS.woodGrain }} />
          <View className="absolute inset-x-6 top-2 h-px" style={{ backgroundColor: MATERIALS.woodGrain }} />
        </Gradient>
      ) : (
        <Gradient colors={kind === 'frost' ? MATERIALS.frost : MATERIALS.glass} className="mx-1 h-2 rounded-sm">
          {kind === 'frost' && <FrostSpecks />}
        </Gradient>
      )}
      <Gradient colors={MATERIALS.shelfShadow} className="mx-2 h-2" />
    </View>
  );
}

function FrostSpecks() {
  return (
    <>
      {[8, 22, 41, 58, 73, 90].map((left) => (
        <View
          key={left}
          className="absolute top-0.5 h-0.5 w-0.5 rounded-full"
          style={{ left: `${left}%`, backgroundColor: MATERIALS.frostSpeck }}
        />
      ))}
    </>
  );
}
