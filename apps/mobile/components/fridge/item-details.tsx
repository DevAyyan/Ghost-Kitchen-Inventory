import { ExpiryField } from '@/components/food/expiry-field';
import { FoodPhoto } from '@/components/food/food-photo';
import { PhotoButtons } from '@/components/food/photo-buttons';
import { StageBadge } from '@/components/stage/stage-badge';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/currency/money';
import { MovePanel } from './move-panel';
import { UsePanel } from './use-panel';
import { formatQty } from '@/lib/domain/units';
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/domain/catalog';
import { shortDate } from '@/lib/domain/dates';
import { EXPIRY_SOURCE_LABEL, MAX_SNIFFS, SNIFF_DAYS, daysLeft, isCookable, remainingText, safetyAdvice, sniffCheck, stageOf } from '@/lib/domain/expiry';
import type { Category, Item } from '@/lib/domain/types';
import { useApp } from '@/lib/store/app-store';
import { toast } from '@/lib/store/toast';
import { ListPlus, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** Details + actions for one item. Rendered in the side panel (desktop) or a sheet (phone/tablet). */
export function ItemDetails({ item, onDone }: { item: Item; onDone: () => void }) {
  const discardItem = useApp((s) => s.discardItem);
  const setExpiry = useApp((s) => s.setExpiry);
  const confirmExpiry = useApp((s) => s.confirmExpiry);
  const setPhoto = useApp((s) => s.setPhoto);
  const setCategory = useApp((s) => s.setCategory);
  const sniffItem = useApp((s) => s.sniffItem);
  const addShopping = useApp((s) => s.addShopping);

  const stage = stageOf(item);
  const rem = daysLeft(item);
  const freshness = Math.max(0, Math.min(1, rem / Math.max(1, item.shelfDays)));
  const advice = safetyAdvice(item, stage);

  const sniff = sniffCheck(item);
  // "Went off early" only means something before the date; afterwards it went off on time.
  const beforeDate = rem >= 0;

  const discard = (wentOff = false) => {
    const res = discardItem(item.id, { wentOff });
    if (res) toast(`${item.name} buried · ${formatMoney(res.value, res.currency)} lost${wentOff ? '. Future dates for it will be more careful.' : ''}`);
    onDone();
  };
  const passCheck = () => {
    const d = sniffItem(item.id);
    if (d) toast(`${item.name}: we'll check in again in ${SNIFF_DAYS} days`);
  };
  const toList = () => {
    toast(addShopping(item.name, { source: 'used-up' }) ? `${item.name} added to the shopping list` : `${item.name} is already on the shopping list`);
  };

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-end gap-3">
        <FoodPhoto photoUri={item.photoUri} category={item.category} stage={stage} size="lg" />
        <View className="min-w-40 flex-1 gap-2">
          <Text className="text-lg font-semibold">{item.name}</Text>
          <StageBadge stage={stage} />
          <PhotoButtons
            hasPhoto={!!item.photoUri}
            onPhoto={(uri) => { setPhoto(item.id, uri); toast(`Photo saved for ${item.name}`); }}
          />
        </View>
      </View>

      <View className="gap-2">
        <Progress value={Math.max(3, freshness * 100)} indicatorClassName={STAGE_STYLE[stage].bg} aria-label="Freshness remaining" />
        <Text className="font-semibold">{remainingText(rem)}</Text>
      </View>

      {item.tip ? <Text className="text-muted-foreground text-sm">Tip: {item.tip}</Text> : null}

      {advice && (
        <Alert icon={ShieldAlert} variant={advice.tone === 'danger' ? 'destructive' : 'default'} iconClassName={advice.tone === 'warning' ? 'text-warning' : undefined}>
          <AlertDescription>{advice.text}</AlertDescription>
        </Alert>
      )}

      {sniff.ok && (
        <View className="border-border gap-2 rounded-lg border p-3">
          <Text role="heading" aria-level={3} className="font-semibold">Still looks and smells fine?</Text>
          <Text className="text-muted-foreground text-sm">
            If it looks, smells and feels normal, we can remind you again in {SNIFF_DAYS} days instead. This doesn't make it safe: check it again before you eat it. ({MAX_SNIFFS - (item.sniffs ?? 0)} left for this item.)
          </Text>
          <Button variant="outline" className="h-11 self-start" onPress={passCheck}>
            <Icon as={ShieldCheck} size={16} />
            <Text>It passed my check</Text>
          </Button>
        </View>
      )}
      {!sniff.ok && sniff.reason === 'high-risk' && rem < SNIFF_DAYS && (
        <Text className="text-muted-foreground text-sm">
          {CATEGORY_LABEL[item.category]} can't be given extra days: it can be unsafe even when it looks and smells fine.
        </Text>
      )}
      {!sniff.ok && sniff.reason === 'used-up' && (
        <Text className="text-muted-foreground text-sm">This has already had {MAX_SNIFFS} extra checks. Use it today or discard it.</Text>
      )}

      <ExpiryField
        expires={item.expires}
        purchased={item.purchased}
        confirmed={item.expiryConfirmed}
        sourceLabel={item.expiryConfirmed ? (item.expirySource === 'user' ? 'Set by you' : 'Confirmed by you') : EXPIRY_SOURCE_LABEL[item.expirySource]}
        itemName={item.name}
        onChange={(d) => setExpiry(item.id, d)}
        onConfirm={() => { confirmExpiry(item.id); toast(`Expiry for ${item.name} confirmed`); }}
      />

      <View className="gap-2">
        <Fact
          label="Amount"
          value={item.fraction < 1 ? `${formatQty(item.qty * item.fraction, item.unit)} left of ${formatQty(item.qty, item.unit)}` : formatQty(item.qty, item.unit)}
        />
        <Fact label="Price" value={formatMoney(item.priceMinor, item.currency)} />
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-muted-foreground text-sm">Type</Text>
          <Select
            value={{ value: item.category, label: CATEGORY_LABEL[item.category] }}
            onValueChange={(o) => o && setCategory(item.id, o.value as Category)}>
            <SelectTrigger className="h-11 w-40" accessibilityLabel={`Type of ${item.name}`} accessibilityHint="Sets the icon shown until you add a photo">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="w-44">
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} label={CATEGORY_LABEL[c]} />
              ))}
            </SelectContent>
          </Select>
        </View>
        <Fact label="Bought" value={shortDate(item.purchased)} />
      </View>
      <Separator />
      <MovePanel item={item} />
      <Separator />

      {isCookable(item) && (
        <>
          <UsePanel item={item} onFinished={onDone} />
          <Separator />
        </>
      )}
      <View className="flex-row flex-wrap gap-2">
        <Button variant="destructive" className="h-11" onPress={() => discard(false)}>
          <Icon as={Trash2} size={16} className="text-white" />
          <Text>{item.fraction < 1 ? 'Discard the rest' : 'Discard'}</Text>
        </Button>
        {beforeDate && (
          <Button variant="outline" className="h-11" onPress={() => discard(true)} accessibilityHint="Discards it and makes future dates for this food shorter">
            <Icon as={Trash2} size={16} />
            <Text>It went off early</Text>
          </Button>
        )}
        <Button variant="ghost" className="h-11" onPress={toList}>
          <Icon as={ListPlus} size={16} />
          <Text>Add to shopping list</Text>
        </Button>
      </View>
      <Text className="text-muted-foreground text-xs">
        Freshness follows the expiry date. Always check the package and the food itself. Food-safety tips are guidance, not a guarantee.
      </Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className="text-sm tabular-nums">{value}</Text>
    </View>
  );
}
