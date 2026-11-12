import { StageBadge } from '@/components/stage/stage-badge';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/currency/money';
import { ZONES } from '@/lib/domain/catalog';
import { shortDate } from '@/lib/domain/dates';
import { daysLeft, remainingText, stageOf } from '@/lib/domain/expiry';
import { forgottenText, isForgotten, untouchedDays } from '@/lib/domain/haunt';
import type { Item } from '@/lib/domain/types';
import { formatQty } from '@/lib/domain/units';
import { View } from 'react-native';
import { STAGE_MEANING } from './stage-key';

/**
 * What the hover card shows for one item: its stage and what that means, the date and whether it's been
 * checked, how much is left and what it's worth. A summary only: everything here is also in the tile's
 * label and the details sheet, so mouse users just get it sooner.
 */
export function FoodHoverDetails({ item }: { item: Item }) {
  const stage = stageOf(item);
  const rem = daysLeft(item);
  const left = item.qty * item.fraction;
  const untouched = untouchedDays(item);

  return (
    <View className="gap-2">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-semibold" numberOfLines={2}>{item.name}</Text>
        <StageBadge stage={stage} />
      </View>
      <Text className="text-muted-foreground text-xs">{STAGE_MEANING[stage]}</Text>
      <Separator />
      <Row label={rem < 0 ? 'Expired' : 'Expires'} value={`${shortDate(item.expires)} · ${remainingText(rem).toLowerCase()}`} />
      <Row label="Date" value={item.expiryConfirmed ? 'Checked' : 'Estimated, please check'} warn={!item.expiryConfirmed} />
      <Row label="Left" value={item.fraction < 1 ? `${formatQty(left, item.unit)} of ${formatQty(item.qty, item.unit)}` : formatQty(item.qty, item.unit)} />
      <Row label="Worth" value={formatMoney(Math.round(item.priceMinor * item.fraction), item.currency)} />
      <Row label="In" value={ZONES[item.zone].label} />
      {isForgotten(item, stage) && untouched !== null && (
        <Text className="text-muted-foreground text-xs italic">Forgotten: {forgottenText(untouched)}.</Text>
      )}
      <Text className="text-muted-foreground text-xs">Click for details and actions.</Text>
    </View>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View className="flex-row gap-2">
      <Text className="text-muted-foreground w-16 text-xs">{label}</Text>
      <Text className={warn ? 'text-warning flex-1 text-xs' : 'flex-1 text-xs tabular-nums'}>{value}</Text>
    </View>
  );
}
