import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { shortDate, today, weekStart } from '@/lib/domain/dates';
import { hasActivity, lastWeekStart, summarizeWeek } from '@/lib/domain/weekly';
import { useSummarize } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { cn } from '@/lib/utils';
import { CalendarRange, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/**
 * The weekly digest as a card. `digest`: last week's summary on the fridge screen, shown once until
 * dismissed (the web's stand-in for the Monday notification). Otherwise: this week so far, on the ledger.
 */
export function WeekCard({ digest }: { digest?: boolean }) {
  const now = today();
  const events = useApp((s) => s.events);
  const receipts = useApp((s) => s.receipts);
  const items = useApp((s) => s.items);
  const seen = useSettings((s) => s.settings.weeklySeen);
  const update = useSettings((s) => s.update);
  const summarize = useSummarize();
  const start = digest ? lastWeekStart(now) : weekStart(now);
  const w = React.useMemo(() => summarizeWeek({ events, receipts, items, start, now }), [events, receipts, items, start, now]);

  if (digest && (seen === start || !hasActivity(w))) return null;

  const rescued = summarize(w.rescued);
  const wasted = summarize(w.wasted);
  const better = w.wastedCount < w.previous.wastedCount;
  const worse = w.wastedCount > w.previous.wastedCount;
  const title = digest ? `Your week in food, ${shortDate(w.start)} – ${shortDate(w.end)}` : 'This week so far';

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex-row items-center gap-2 px-4">
        <Icon as={CalendarRange} size={18} className="text-primary" />
        <CardTitle role="heading" aria-level={2} className="flex-1">{title}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        <View className="flex-row flex-wrap gap-3">
          <Stat label="Rescued" value={w.rescuedCount ? rescued.text : 'None yet'} note={`${w.rescuedCount} item${w.rescuedCount === 1 ? '' : 's'} used while turning`} accent="border-l-stage-fresh" />
          <Stat label="Thrown out" value={w.wastedCount ? wasted.text : 'None'} note={`${w.wastedCount} item${w.wastedCount === 1 ? '' : 's'}`} accent="border-l-destructive" />
        </View>
        {(better || worse) && (
          <View className="flex-row items-center gap-2">
            <Icon as={better ? TrendingDown : TrendingUp} size={16} className={better ? 'text-stage-fresh' : 'text-destructive'} />
            <Text className="text-sm">
              {better ? 'Less' : 'More'} thrown out than the week before ({w.wastedCount} vs {w.previous.wastedCount}).
            </Text>
          </View>
        )}
        {w.topWasted.length > 0 && (
          <Text className="text-muted-foreground text-sm">Most binned: {w.topWasted.map((t) => (t.count > 1 ? `${t.name} (${t.count})` : t.name)).join(', ')}.</Text>
        )}
        {w.comingUp.length > 0 && (
          <Text className="text-muted-foreground text-sm">
            Turning in the next 7 days: {w.comingUp.slice(0, 5).join(', ')}{w.comingUp.length > 5 ? ` and ${w.comingUp.length - 5} more` : ''}.
          </Text>
        )}
        {w.tips.map((t) => (
          <View key={t} className="flex-row items-start gap-2">
            <Icon as={Lightbulb} size={14} className="text-warning mt-0.5" />
            <Text className="flex-1 text-sm">{t}</Text>
          </View>
        ))}
        {digest && (
          <Button variant="ghost" className="h-11 self-start" onPress={() => update({ weeklySeen: start })}>
            <Text>Got it</Text>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) {
  return (
    <View role="group" accessibilityLabel={`${label}: ${value}, ${note}`} className={cn('border-border bg-background min-w-36 flex-1 gap-0.5 rounded-md border border-l-4 p-3', accent)}>
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Text className="text-lg font-bold tabular-nums">{value}</Text>
      <Text className="text-muted-foreground text-xs">{note}</Text>
    </View>
  );
}
