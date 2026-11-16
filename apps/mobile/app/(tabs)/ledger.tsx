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
import { shortDate } from '@/lib/domain/dates';
import { isAtRisk, stageOf } from '@/lib/domain/expiry';
import { useActiveItems } from '@/lib/hooks';
import { LEDGER_DAYS, useRatesFor, withinLedgerWindow } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { cn } from '@/lib/utils';
import { Coins, Receipt, History, Skull } from 'lucide-react-native';
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

  return (
    <Screen
      title="Ledger"
      description={`Last ${LEDGER_DAYS} days · amounts are kept in their original currency`}
      actions={<CurrencyChip code={display} prefix="Show in" showName={false} onPress={() => setPickerOpen(true)} />}>
      <View className="flex-row flex-wrap gap-3">
        {/* Spending is neither good nor bad, so it gets a neutral bar; the colours mean saved, wasted, at risk. */}
        <Kpi label="Spent" m={spend} note={`${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`} accent="border-t-muted-foreground/40" />
        <Kpi label="Waste avoided" m={avoided} note="used before it spoiled" accent="border-t-stage-fresh" />
        <Kpi label="Wasted" m={wasted} note="buried in the graveyard" accent="border-t-destructive" />
        <Kpi label="At risk now" m={risk} note="expiring or rotting" accent="border-t-stage-expiring" />
      </View>

      <WeekCard />
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
      {rescue !== null && (
        <View className="gap-2">
          <View className="flex-row justify-between">
            <Text className="text-sm">Rescue rate</Text>
            <Text className="text-sm font-semibold">{rescue}% of at-risk food saved</Text>
          </View>
          <Progress value={rescue} indicatorClassName="bg-stage-fresh" className="bg-destructive/30 h-3" aria-label={`${rescue}% rescued`} />
        </View>
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
              photo={<FoodPhoto photoUri={e.photoUri} category={e.category} size="xs" />}
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

function Kpi({ label, m, note, accent }: { label: string; m: MoneySummary; note: string; accent: string }) {
  return (
    <View role="group" accessibilityLabel={`${label}: ${m.text}`} className={cn('border-border bg-card min-w-40 flex-1 gap-1 rounded-lg border border-t-4 p-3', accent)}>
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Text className="text-lg font-bold tabular-nums">{m.text}</Text>
      <Text className="text-muted-foreground text-xs">{m.detail ?? note}</Text>
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
