import { DropIn } from '@/components/common/pixel-motion';
import { justArrived } from '@/lib/store/arrivals';
import { FoodPhoto } from '@/components/food/food-photo';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Text } from '@/components/ui/text';
import { daysLeft, remainingText, stageOf, tileDateText } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { forgottenText, isForgotten, untouchedDays } from '@/lib/domain/haunt';
import { formatAmount, formatQty, spokenQty } from '@/lib/domain/units';
import { useDay } from '@/lib/store/clock';
import { FONT_EM, fitLabel, fitOneLine } from '@/lib/text-fit';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { FoodHoverDetails } from './food-hover-card';
import { StageGlyph } from '@/components/stage/stage-glyph';
import { COLORS } from '@/lib/theme';
import { RisingGhost } from './ghost';
import { EmberEdge, EmberStrip, PixelCobweb, PixelFlies, PixelMould, PixelTexture, PX } from './pixel-effects';

/**
 * Base tile width in px (matches `w-14 md:w-20`) and the gap between tiles (`gap-2 md:gap-3`), for shelf row
 * maths. Phones use the smaller size so a 320 px screen still fits four tiles on a shelf.
 */
export const tileWidth = (isPhone: boolean) => (isPhone ? 56 : 80);
/** Same ghost for the same item every time. */
const ghostFor = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);

export const tileGap = (isPhone: boolean) => (isPhone ? 8 : 12);

interface FoodTileProps {
  item: Item;
  selected: boolean;
  onPress: (id: string) => void;
  /** Press and hold: quick actions without opening the item ("Used it all", "Binned it"). */
  onLongPress?: (id: string) => void;
  /** Desktop browser with a mouse: show a floating summary card on hover (see useCanHover). */
  hoverCard?: boolean;
  /** Width in px when the shelf stretches tiles to fill its row; the base width otherwise. */
  width?: number;
}

/** How long the pointer rests on a tile before its card opens, and lingers after leaving. */
const HOVER_OPEN_MS = 500;
const HOVER_CLOSE_MS = 0;

/**
 * One food item on a shelf: the user's photo, name and days left.
 * Stage = border colour + border style + corner icon + days text, plus its decay "costume": yellowing
 * (aging), pixel flames (expiring), mould, flies and a cobweb (rotting), a big cobweb and a rising ghost
 * (spoiled), dust (forgotten). All pixel art.
 */
export const FoodTile = React.memo(function FoodTile({ item, selected, onPress, onLongPress, hoverCard, width }: FoodTileProps) {
  // Tiles are memoised on the item, so they listen for the date turning themselves.
  useDay((s) => s.day);
  // Food added here or by someone sharing the kitchen drops onto the shelf; food already there doesn't.
  const [arrived] = React.useState(() => justArrived(item.id));
  const tile = hoverCard
    ? <HoverableTile item={item} selected={selected} onPress={onPress} onLongPress={onLongPress} width={width} />
    : <Tile item={item} selected={selected} onPress={onPress} onLongPress={onLongPress} width={width} />;
  return arrived ? <DropIn play>{tile}</DropIn> : tile;
});

function HoverableTile({ item, selected, onPress, onLongPress, width }: Omit<FoodTileProps, 'hoverCard'>) {
  // Clicking opens the full details, so the summary gets out of the way and stays hidden until the pointer
  // leaves the tile; the hover card then reports itself closed, which re-arms it for the next hover.
  const [dismissed, setDismissed] = React.useState(false);
  return (
    <HoverCard openDelay={HOVER_OPEN_MS} closeDelay={HOVER_CLOSE_MS} onOpenChange={(open) => !open && setDismissed(false)}>
      <HoverCardTrigger asChild>
        <Tile item={item} selected={selected} width={width} onLongPress={onLongPress} onPress={(id) => { setDismissed(true); onPress(id); }} />
      </HoverCardTrigger>
      {!dismissed && (
        // Narrow, and it never takes the pointer: moving onto a neighbour shows that one instead, and a click
        // goes through to whatever is under it. It only shows while the pointer rests on this tile.
        <HoverCardContent side="top" sideOffset={6} className="pointer-events-none w-56 p-3" aria-hidden>
          <FoodHoverDetails item={item} />
        </HoverCardContent>
      )}
    </HoverCard>
  );
}

/** Forwards its ref and any trigger props (pointer handlers from the hover card) to the Pressable. */
const Tile = React.forwardRef<View, Omit<FoodTileProps, 'hoverCard'> & Omit<React.ComponentProps<typeof Pressable>, 'onPress' | 'onLongPress' | 'children'>>(function Tile(
  { item, selected, onPress, onLongPress, width, ...triggerProps },
  ref
) {
  const stage = stageOf(item);
  const s = STAGE_STYLE[stage];
  const rem = daysLeft(item);
  const partly = item.fraction < 1;
  const left = item.qty * item.fraction;
  // Badge: what's left, when that's useful: "5 left" of a dozen eggs, "0.4 kg" of tomatoes.
  const amountBadge = partly || item.qty !== 1 || item.unit !== 'pcs'
    ? (item.unit === 'pcs' ? `${formatAmount(left)}${partly ? ' left' : ''}` : formatQty(left, item.unit))
    : null;

  // Always two lines tall, so every tile on a shelf is the same height. The name takes the biggest size at
  // which each word fits the tile (its width less px-1 and the 2 px border, measured: 56 px → 44 px, less
  // 2 px because the browser draws bold a hair wider); a word too long even at 12 px is hyphenated
  // ("Strawber-ries") rather than cut off.
  const name = fitLabel(item.name, (width ?? tileWidth(true)) - 14, FONT_EM.pixel, [15, 13, 12]);
  const dateText = tileDateText(rem, item.expiryConfirmed);
  const dateSize = fitOneLine(dateText, (width ?? tileWidth(true)) - 10, FONT_EM.pixel, [13, 12, 11]);
  const untouched = untouchedDays(item);
  const forgotten = isForgotten(item, stage);

  const label = [
    item.name,
    s.label,
    remainingText(rem),
    item.expiryConfirmed ? null : 'expiry date estimated, please check',
    amountBadge ? `${spokenQty(left, item.unit)}${partly ? ' left' : ''}` : null,
    forgotten && untouched !== null ? forgottenText(untouched) : null,
  ].filter(Boolean).join(', ');

  return (
    <Pressable
      ref={ref}
      {...triggerProps}
      onPress={() => onPress(item.id)}
      onLongPress={onLongPress ? () => onLongPress(item.id) : undefined}
      delayLongPress={400}
      accessibilityHint={onLongPress ? 'Press and hold for quick actions' : undefined}
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: 'Quick actions' }] : undefined}
      onAccessibilityAction={onLongPress ? (e) => { if (e.nativeEvent.actionName === 'longpress') onLongPress(item.id); } : undefined}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={width ? { width } : undefined}
      className={cn(
        'bg-background/90 web:hover:bg-accent relative min-h-20 w-14 justify-center rounded-none border-2 border-b-4 px-1 py-1 md:min-h-24 md:w-20',
        'web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none',
        s.border,
        stage === 'rotting' && 'bg-stage-rotting/10',
        selected && 'border-primary'
      )}>
      {stage === 'expiring' && <EmberEdge />}
      {stage === 'rotting' && <PixelFlies />}
      {/* Webs in the top-left corner, clear of the stage badge (top right) and the text below the photo. */}
      {stage === 'rotting' && <PixelCobweb size={20} />}
      {stage === 'spoiled' && <PixelCobweb big size={30} />}
      {stage === 'spoiled' && <RisingGhost variant={ghostFor(item.id)} />}
      <View className="items-center gap-0.5">
        <FoodPhoto photoUri={item.photoUri} category={item.category} name={item.name} stage={stage} size="tile" pixel>
          {stage === 'aging' && <PixelTexture source={PX.aging} />}
          {stage === 'expiring' && <EmberStrip />}
          {stage === 'rotting' && <PixelMould id={item.id} daysOver={-rem} />}
          {/* Dust settles on food nobody has touched in weeks. */}
          {forgotten && <PixelTexture source={PX.dust} />}
        </FoodPhoto>
        <View className="h-8 w-full justify-center">
          <Text numberOfLines={name.lines} className="w-full text-center font-semibold" style={{ fontSize: name.size, lineHeight: name.size }}>
            {name.text}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          className={cn('tabular-nums', item.expiryConfirmed ? 'text-muted-foreground' : 'text-warning')}
          style={{ fontSize: dateSize, lineHeight: 14 }}>
          {/* One line on every tile, so food with an estimated date isn't taller than the rest of the shelf.
              The exact days, and that it's an estimate, are in the label. */}
          {dateText}
        </Text>
      </View>
      {/* The stage as an 8 × 8 glyph at 16 px (2 px a dot), so the five stages tell apart at a glance. */}
      <View className={cn('border-background absolute -right-2 -top-2 h-7 w-7 items-center justify-center border-2', s.bg)}>
        <StageGlyph stage={stage} color={COLORS.background} />
      </View>
      {/* How much is left lives in the hover card and the item sheet: the tile shows only what to act on. */}
    </Pressable>
  );
});
