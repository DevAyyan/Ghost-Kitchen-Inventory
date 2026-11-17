import { FoodPhoto } from '@/components/food/food-photo';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { daysLeft, remainingText, shortRemaining, stageOf } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { forgottenText, isForgotten, untouchedDays } from '@/lib/domain/haunt';
import { formatAmount, formatQty, spokenQty } from '@/lib/domain/units';
import { useDay } from '@/lib/store/clock';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { FoodHoverDetails } from './food-hover-card';
import { RisingGhost } from './ghost';
import { Cobweb, ExpiringGlow, Flies, Mould, Yellowing } from './haunt-effects';

/** Base tile width in px (matches `w-16 md:w-20`) and the gap between tiles (`gap-3`), for shelf row maths. */
export const TILE_GAP = 12;
export const tileWidth = (isPhone: boolean) => (isPhone ? 64 : 80);

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
const HOVER_OPEN_MS = 350;
const HOVER_CLOSE_MS = 100;

/**
 * One food item on a shelf: the user's photo, name and days left.
 * Stage = border colour + border style + corner icon + days text, plus its decay "costume": yellowing
 * (aging), glow (expiring), mould and flies (rotting), a rising ghost (spoiled), cobwebs (forgotten).
 */
export const FoodTile = React.memo(function FoodTile({ item, selected, onPress, onLongPress, hoverCard, width }: FoodTileProps) {
  // Tiles are memoised on the item, so they listen for the date turning themselves.
  useDay((s) => s.day);
  if (!hoverCard) return <Tile item={item} selected={selected} onPress={onPress} onLongPress={onLongPress} width={width} />;
  return <HoverableTile item={item} selected={selected} onPress={onPress} onLongPress={onLongPress} width={width} />;
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
        <HoverCardContent side="top" className="w-64 p-3" aria-hidden>
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
        'bg-background/80 web:hover:bg-accent relative min-h-24 w-16 justify-center rounded-lg border-2 px-1 py-1 md:w-20',
        'web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none',
        s.border,
        stage === 'rotting' && 'bg-stage-rotting/10',
        selected && 'border-primary'
      )}>
      {stage === 'expiring' && <ExpiringGlow />}
      {stage === 'rotting' && <Flies />}
      {stage === 'spoiled' && <RisingGhost />}
      <View className="items-center gap-0.5">
        <FoodPhoto photoUri={item.photoUri} category={item.category} name={item.name} stage={stage} size="md">
          {stage === 'aging' && <Yellowing />}
          {stage === 'rotting' && <Mould id={item.id} daysOver={-rem} />}
          {/* Inside the photo's bottom corner, so it never covers the name, days left or the badges. */}
          {forgotten && <Cobweb className="bottom-0 right-0 h-7 w-7 rotate-180" />}
        </FoodPhoto>
        {/* Always two lines tall, so every tile on a shelf is the same height. Only names with a space wrap:
            a single long word ("Strawberries") would otherwise be split mid-word, so it ends in "…" instead. */}
        <View className="h-7 w-full justify-center">
          <Text numberOfLines={/\s/.test(item.name.trim()) ? 2 : 1} className="w-full text-center text-xs font-semibold leading-3.5">
            {item.name}
          </Text>
        </View>
        <Text className={cn('text-[11px] tabular-nums', item.expiryConfirmed ? 'text-muted-foreground' : 'text-warning')}>
          {shortRemaining(rem)}
          {item.expiryConfirmed ? '' : ' · est.'}
        </Text>
      </View>
      <View className={cn('border-background absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full border-2', s.bg)}>
        <Icon as={s.icon} size={12} className="text-background" />
      </View>
      {/* How much is left lives in the hover card and the item sheet: the tile shows only what to act on. */}
    </Pressable>
  );
});
