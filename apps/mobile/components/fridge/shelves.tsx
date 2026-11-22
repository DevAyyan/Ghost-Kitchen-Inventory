import { Text } from '@/components/ui/text';
import type { Item, Zone } from '@/lib/domain/types';
import { useCanHover, useLayout } from '@/lib/hooks';
import { PIXEL } from '@/lib/theme';
import * as React from 'react';
import { View } from 'react-native';
import { FoodTile, tileGap, tileWidth } from './food-tile';
import { PixelTexture, PX } from './pixel-effects';


interface ShelvesProps {
  items: Item[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Press and hold a tile: quick actions. */
  onQuick?: (id: string) => void;
  /** Which compartment: picks the shelf colours. */
  kind: Zone;
  /** Shelves drawn even when empty, so an empty fridge still looks like a fridge. */
  minShelves: number;
  /** True when a filter or search is active (changes the empty message). */
  filtered: boolean;
}

/**
 * Splits items into rows that fit the measured width, each row standing on its own shelf. Tiles then
 * stretch to share the row's spare width (so names get more room), up to MAX_STRETCH of their base size.
 */
export function Shelves({ items, selectedId, onSelect, onQuick, kind, minShelves, filtered }: ShelvesProps) {
  const { isPhone } = useLayout();
  const canHover = useCanHover();
  const [width, setWidth] = React.useState(0);
  const base = tileWidth(isPhone);
  const gap = tileGap(isPhone);
  const perRow = width === 0 ? 4 : Math.max(1, Math.floor((width - ROW_PADDING + gap) / (base + gap)));
  const fill = width === 0 ? base : Math.floor((width - ROW_PADDING - gap * (perRow - 1)) / perRow);
  const pixel = PIXEL[kind];
  const tileW = Math.max(base, Math.min(fill, Math.round(base * MAX_STRETCH)));

  const rows: Item[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  while (rows.length < minShelves) rows.push([]);
  const firstEmpty = rows.findIndex((r) => r.length === 0);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {rows.map((row, idx) => (
        <View key={idx}>
          <View className="min-h-28 flex-row items-end gap-2 px-3 pt-4 md:min-h-32 md:gap-3">
            {row.length ? (
              row.map((i) => <FoodTile key={i.id} item={i} selected={i.id === selectedId} onPress={onSelect} onLongPress={onQuick} hoverCard={canHover} width={tileW} />)
            ) : idx === 0 ? (
              <Text className="self-center pb-4 text-xs italic" style={{ color: pixel.insideText }}>
                {filtered ? 'Nothing matches here' : 'Empty'}
              </Text>
            ) : idx === firstEmpty && !filtered ? (
              // The spare shelves under a few items say what they're for, instead of just being bare.
              <Text className="self-center pb-4 text-xs italic" style={{ color: pixel.insideText, opacity: 0.75 }}>
                Room for more
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

/** A pixel board: lit top edge, face, dark lip, then a dithered shadow on the wall below. */
function ShelfSurface({ kind }: { kind: Zone }) {
  const pixel = PIXEL[kind];
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants">
      <View style={{ height: 3, backgroundColor: pixel.shelfTop }} />
      <View style={{ height: 6, backgroundColor: pixel.shelf }} />
      <View style={{ height: 3, backgroundColor: pixel.edge }} />
      <View style={{ height: 6 }}>
        <PixelTexture source={PX.shelfShadow} />
      </View>
    </View>
  );
}
