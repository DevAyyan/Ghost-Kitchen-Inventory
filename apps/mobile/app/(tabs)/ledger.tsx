import { EmptyState } from '@/components/common/empty-state';
import { Screen } from '@/components/common/screen';
import { CurrencyChip } from '@/components/currency/currency-chip';
import { CurrencyPicker } from '@/components/currency/currency-picker';
import { FoodPhoto } from '@/components/food/food-photo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { type MoneySummary, formatMoney, summarize as baseSummarize } from '@/lib/currency/money';
import { STAGE_META } from '@/lib/domain/catalog';
import { formatQty } from '@/lib/domain/units';
import { addDays, shortDate, today } from '@/lib/domain/dates';
import { isAtRisk, stageOf } from '@/lib/domain/expiry';
import { useActiveItems } from '@/lib/hooks';
import { LEDGER_DAYS, useRatesFor, withinLedgerWindow } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { eventPhoto } from '@/lib/store/migrations';
import { useSettings } from '@/lib/store/settings-store';
import { cn } from '@/lib/utils';
import { Coins, Receipt, History, Skull, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { WeekCard } from '@/components/ledger/week-card';
import { useLayout } from '@/lib/hooks';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

export default function LedgerScreen() {
  const items = useActiveItems();
  const allReceipts = useApp((s) => s.receipts);
  const allEvents = useApp((s) => s.events);
  const allItems = useApp((s) => s.items);
  const itemsById = React.useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);
  const receipts = allReceipts.filter((r) => withinLedgerWindow(r.date));
  const events = allEvents.filter((e) => withinLedgerWindow(e.date));
  const display = useSettings((s) => s.settings.displayCurrency);
  const rates = useRatesFor(display);
  const summarize = (entries: Parameters<typeof baseSummarize>[0]) => baseSummarize(entries, display, rates?.rates);
  const updateSettings = useSettings((s) => s.update);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const { isPhone } = useLayout();
  const router = useRouter();

  const spend = summarize(receipts.map((r) => ({ minor: r.totalMinor, currency: r.currency })));
  const avoided = summarize(events.filter((e) => e.type === 'used' && e.stage !== 'fresh'));
  const wasted = summarize(events.filter((e) => e.type === 'discarded'));
  const risk = summarize(items.filter((i) => isAtRisk(stageOf(i))).map((i) => ({ minor: Math.round(i.priceMinor * i.fraction), currency: i.currency })));
  const all = [spend, avoided, wasted, risk];
  const converted = all.some((m) => m.converted);
  const uncovered = [...new Set(all.flatMap((m) => m.uncovered))];
  const rescue =
    avoided.value !== null && wasted.value !== null && avoided.value + wasted.value > 0
      ? Math.round((avoided.value / (avoided.value + wasted.value)) * 100) : null;
  // Against the 30 days before: is it getting better? Only when both are in one comparable figure.
  const before = summarize(allEvents.filter((e) => e.type === 'discarded' && e.date < addDays(today(), -LEDGER_DAYS) && e.date >= addDays(today(), -2 * LEDGER_DAYS)));
  const trend = wasted.value !== null && before.value !== null && (wasted.value > 0 || before.value > 0)
    ? { better: wasted.value <= before.value, text: wasted.value === before.value ? 'same as the 30 days before' : `${wasted.value < before.value ? 'less' : 'more'} than the 30 days before (${before.text})` }
    : null;

  return (
    <Screen
      title="Ledger"
      description={`Last ${LEDGER_DAYS} days · amounts are kept in their original currency`}
      actions={<CurrencyChip code={display} prefix="Show in" showName={false} onPress={() => setPickerOpen(true)} />}>
      {/* One number up top: what was thrown away. The rest is a small breakdown under it. */}
      <View role="group" aria-label={`Wasted in the last ${LEDGER_DAYS} days: ${wasted.text}`} className="border-border bg-card gap-3 rounded-lg border p-4">
        <View className="gap-1">
          <Text className="text-muted-foreground text-sm">Wasted, last {LEDGER_DAYS} days</Text>
          <View className="flex-row flex-wrap items-end gap-x-3 gap-y-1">
            <Text className="text-destructive text-4xl font-bold tabular-nums">{wasted.text}</Text>
            {trend && (
              <View className="flex-row items-center gap-1 pb-1.5">
                <Icon as={trend.better ? TrendingDown : TrendingUp} size={16} className={trend.better ? 'text-stage-fresh' : 'text-destructive'} />
                <Text className="text-muted-foreground text-sm">{trend.text}</Text>
              </View>
            )}
          </View>
          {wasted.detail ? <Text className="text-muted-foreground text-xs">{wasted.detail}</Text> : null}
        </View>
        {rescue !== null && (
          <View className="gap-1">
            <Progress value={rescue} indicatorClassName="bg-stage-fresh" className="bg-destructive/30 h-2" aria-label={`${rescue}% of food that started to turn was rescued`} />
            <Text className="text-muted-foreground text-xs">{rescue}% of food that started to turn was rescued</Text>
          </View>
        )}
        <View className="border-border flex-row border-t pt-3">
          <Mini label="Spent" m={spend} />
          <Mini label="Saved" m={avoided} className="text-stage-fresh" />
          <Mini label="At risk now" m={risk} className="text-stage-expiring" />
        </View>
      </View>

      {/* Last week's summary (the web's stand-in for the Monday notification), shown until dismissed. */}
      <WeekCard digest />
      {isPhone && (
        <Button variant="outline" className="h-11 self-start" onPress={() => router.navigate('/graveyard')}>
          <Icon as={Skull} size={16} />
          <Text>Open the graveyard</Text>
        </Button>
      )}

      {converted && (
        <Text className="text-muted-foreground text-xs">
          Converted to {display} with reference rates from {rates ? shortDate(rates.date) : 'the last update'} (Frankfurter){rates?.stale ? '. The rate service is unreachable, so these may be out of date.' : '.'}
        </Text>
      )}
      {uncovered.length > 0 && (
        <Alert icon={Coins} iconClassName="text-warning" className="border-warning/60">
          <AlertDescription>
            {uncovered.join(', ')} {uncovered.length === 1 ? "has" : "have"} no exchange rate right now, so mixed totals are shown per currency instead of converted.
          </AlertDescription>
        </Alert>
      )}

      <Card className="gap-2 py-4">
        <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>Receipts</CardTitle></CardHeader>
        <CardContent className="px-4">
          {receipts.length === 0 && (
            <EmptyState inCard icon={Receipt} title="No receipts yet" description={`Scanned receipts from the last ${LEDGER_DAYS} days will be listed here.`} />
          )}
          {receipts.map((r) => (
            <Row key={r.id} left={r.store} middle={shortDate(r.date)} right={formatMoney(r.totalMinor, r.currency)} />
          ))}
        </CardContent>
      </Card>

      <Card className="gap-2 py-4">
        <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>Activity</CardTitle></CardHeader>
        <CardContent className="px-4">
          {events.length === 0 && (
            <EmptyState inCard icon={History} title="No activity yet" description="Items you use up or bury will show up here." />
          )}
          {events.slice(0, 12).map((e) => (
            <Row
              key={e.id}
              left={e.name}
              photo={<FoodPhoto photoUri={eventPhoto(e, itemsById)} category={e.category} name={e.name} size="xs" />}
              middle={`${e.type === 'used' ? 'Used' : 'Buried'}${e.amount !== undefined && e.unit ? ` ${formatQty(e.amount, e.unit)}` : ''} · ${STAGE_META[e.stage].label.toLowerCase()}`}
              right={`${e.type === 'discarded' ? '−' : ''}${formatMoney(e.minor, e.currency)}`}
              rightClass={e.type === 'discarded' ? 'text-destructive' : e.stage !== 'fresh' ? 'text-stage-fresh' : 'text-muted-foreground'}
            />
          ))}
        </CardContent>
      </Card>

      <CurrencyPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Display currency"
        note="Ledger totals and recipe savings are shown in this currency."
        value={display}
        onSelect={(code) => updateSettings({ displayCurrency: code })}
      />
    </Screen>
  );
}

/** One small figure in the breakdown under the hero number. */
function Mini({ label, m, className }: { label: string; m: MoneySummary; className?: string }) {
  return (
    <View role="group" accessibilityLabel={`${label}: ${m.text}`} className="min-w-0 flex-1 gap-0.5">
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Text className={cn('font-semibold tabular-nums', className)} numberOfLines={1}>{m.text}</Text>
    </View>
  );
}

function Row({ left, middle, right, rightClass, photo }: { left: string; middle: string; right: string; rightClass?: string; photo?: React.ReactNode }) {
  return (
    <View className="border-border min-h-11 flex-row items-center gap-3 border-b py-2 last:border-b-0">
      {photo}
      <Text className="flex-1 text-sm" numberOfLines={1}>{left}</Text>
      <Text className="text-muted-foreground text-xs">{middle}</Text>
      <Text className={cn('min-w-20 text-right text-sm tabular-nums', rightClass)}>{right}</Text>
    </View>
  );
}
