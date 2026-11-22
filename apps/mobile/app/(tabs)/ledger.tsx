import { CountUpMoney } from '@/components/common/count-up';
import { BadgeGrid } from '@/components/profile/badge-grid';
import { badges, myEvents, personalStats } from '@/lib/domain/profile';
import { useAuthStore } from '@/lib/store/auth-store';
import { useHousehold } from '@/lib/store/household-store';
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
import { budgetStatus, receiptsThisMonth } from '@/lib/domain/budget';
import { CAR_KG_PER_KM, FOOTPRINT_SOURCE, footprintOf, formatCo2, formatWater } from '@/lib/domain/impact';
import { isAtRisk, stageOf } from '@/lib/domain/expiry';
import { useActiveItems } from '@/lib/hooks';
import { LEDGER_DAYS, useRatesFor, withinLedgerWindow } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { eventPhoto } from '@/lib/store/migrations';
import { useSettings } from '@/lib/store/settings-store';
import { cn } from '@/lib/utils';
import { Leaf, Wallet, Coins, Receipt, History, Tombstone, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { WeekCard } from '@/components/ledger/week-card';
import { HouseholdBoard } from '@/components/ledger/household-board';
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
  // The budget is for the calendar month, so it uses its own receipts, not the 30-day window above.
  const budgetSetting = useSettings((st) => st.settings);
  const monthSpend = summarize(receiptsThisMonth(allReceipts, today()).map((r) => ({ minor: r.totalMinor, currency: r.currency })));
  const budgetIn = summarize([{ minor: budgetSetting.monthlyBudgetMinor, currency: budgetSetting.monthlyBudgetCurrency }]);
  const budget = budgetStatus(monthSpend.value, budgetIn.value ?? 0, today());
  const savedFoot = footprintOf(events.filter((e) => e.type === 'used' && e.stage !== 'fresh'));
  const lostFoot = footprintOf(events.filter((e) => e.type === 'discarded'));
  const skipped = savedFoot.skipped + lostFoot.skipped;
  // Your own badges and streak, for everyone: with an account they count only what you did.
  const meId = useAuthStore((st) => st.me?.id ?? null);
  const sharing = useHousehold((st) => !!st.household);
  const stats = React.useMemo(() => personalStats(myEvents(allEvents, meId, sharing), today()), [allEvents, meId, sharing]);
  const badgeList = React.useMemo(() => badges(stats), [stats]);
  const all = [spend, avoided, wasted, risk, ...(budget ? [monthSpend, budgetIn] : [])];
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
            <CountUpMoney summary={wasted} currency={display} className="text-destructive text-4xl font-bold tabular-nums" />
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

      {(savedFoot.counted > 0 || lostFoot.counted > 0) && (
        <View role="group" aria-label="Climate cost of your food, last 30 days" className="border-border bg-card gap-2 rounded-lg border p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={Leaf} size={16} className="text-stage-fresh" />
            <Text className="text-muted-foreground text-sm">Climate cost, last {LEDGER_DAYS} days (rough estimate)</Text>
          </View>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-36 flex-1 gap-0.5">
              <Text className="text-muted-foreground text-xs">Kept out of the bin</Text>
              <Text className="text-stage-fresh text-xl font-bold tabular-nums">{formatCo2(savedFoot.co2Kg)} CO₂e</Text>
              <Text className="text-muted-foreground text-xs">{formatWater(savedFoot.waterL)} of water</Text>
            </View>
            <View className="min-w-36 flex-1 gap-0.5">
              <Text className="text-muted-foreground text-xs">Thrown away</Text>
              <Text className="text-destructive text-xl font-bold tabular-nums">{formatCo2(lostFoot.co2Kg)} CO₂e</Text>
              <Text className="text-muted-foreground text-xs">{formatWater(lostFoot.waterL)} of water</Text>
            </View>
          </View>
          {savedFoot.co2Kg >= 1 && (
            <Text className="text-sm">The food you rescued took about as much CO₂ to produce as driving {Math.round(savedFoot.co2Kg / CAR_KG_PER_KM)} km in a typical car.</Text>
          )}
          <Text className="text-muted-foreground text-xs">
            Farm-to-shop averages per kg of each food ({FOOTPRINT_SOURCE}; car: US EPA).{skipped === 1 ? ' 1 entry without a known amount or food type isn\'t counted.' : skipped > 1 ? ` ${skipped} entries without a known amount or food type aren't counted.` : ''}
          </Text>
        </View>
      )}

      {budget && (
        <View role="group" aria-label={`Monthly budget: ${monthSpend.text} of ${budgetIn.text}`} className="border-border bg-card gap-2 rounded-lg border p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={Wallet} size={16} className="text-muted-foreground" />
            <Text className="text-muted-foreground text-sm">Groceries this month</Text>
          </View>
          <Text className={cn('text-2xl font-bold tabular-nums', budget.over && 'text-destructive')}>{monthSpend.text} <Text className="text-muted-foreground text-base font-normal">of {budgetIn.text}</Text></Text>
          <Progress value={Math.min(100, Math.round(budget.used * 100))} indicatorClassName={budget.over ? 'bg-destructive' : budget.used > 0.8 ? 'bg-stage-expiring' : 'bg-stage-fresh'} className="h-2" aria-label={`${Math.round(budget.used * 100)}% of the monthly budget spent`} />
          <Text className="text-muted-foreground text-xs">
            {budget.over ? `${formatMoney(-budget.leftMinor, display)} over budget.` : `${formatMoney(budget.leftMinor, display)} left, about ${formatMoney(Math.floor(budget.leftMinor / budget.daysLeft), display)} a day for the rest of the month.`}
          </Text>
        </View>
      )}

      <HouseholdBoard />

      {/* Last week's summary (the web's stand-in for the Monday notification), shown until dismissed. */}
      <WeekCard digest />
      {isPhone && (
        <Button variant="outline" className="h-11 self-start" onPress={() => router.navigate('/graveyard')}>
          <Icon as={Tombstone} size={16} />
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

      {allEvents.length > 0 && (
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle role="heading" aria-level={2}>Badges · {badgeList.filter((b) => b.earned).length} of {badgeList.length}</CardTitle>
            <Text className="text-muted-foreground text-sm">
              {stats.streak > 0
                ? `${stats.streak} quiet week${stats.streak === 1 ? '' : 's'} in a row: food rescued, nothing thrown out.`
                : 'A quiet week is one where you rescue food and throw none out.'}
            </Text>
          </CardHeader>
          <CardContent className="px-4"><BadgeGrid list={badgeList} /></CardContent>
        </Card>
      )}

      <Card className="gap-2 py-4">
        <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>Receipts</CardTitle></CardHeader>
        <CardContent className="px-4">
          {receipts.length === 0 && (
            <EmptyState inCard icon={Receipt} title="No receipts yet" description={`Scanned receipts from the last ${LEDGER_DAYS} days will be listed here.`} action={<Button variant="outline" className="h-11" onPress={() => router.navigate('/scan')}><Text>Scan a receipt</Text></Button>} />
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
            <EmptyState inCard icon={History} title="No activity yet" description="Items you use up or bury will show up here." action={<Button variant="outline" className="h-11" onPress={() => router.navigate('/')}><Text>Open your fridge</Text></Button>} />
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
  const display = useSettings((st) => st.settings.displayCurrency);
  return (
    <View role="group" accessibilityLabel={`${label}: ${m.text}`} className="min-w-0 flex-1 gap-0.5">
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <CountUpMoney summary={m} currency={display} numberOfLines={1} className={cn('font-semibold tabular-nums', className)} />
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
