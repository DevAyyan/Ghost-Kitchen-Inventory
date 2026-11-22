import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Art } from '@/components/halloween/art';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { shortDate, today, weekStart } from '@/lib/domain/dates';
import { hasActivity, lastWeekStart, summarizeWeek, weekStory } from '@/lib/domain/weekly';
import { footprintOf } from '@/lib/domain/impact';
import { addDays } from '@/lib/domain/dates';
import { StorySheet } from '@/components/ledger/story-card';
import { useSummarize } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { cn } from '@/lib/utils';
import { CalendarRange, Lightbulb, Share2, TrendingDown, TrendingUp } from 'lucide-react-native';
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
  const [sharing, setSharing] = React.useState(false);
  const w = React.useMemo(() => summarizeWeek({ events, receipts, items, start, now }), [events, receipts, items, start, now]);

  if (digest && (seen === start || !hasActivity(w))) return null;

  const end = addDays(start, 6);
  const co2SavedKg = footprintOf(events.filter((e) => e.type === 'used' && e.stage !== 'fresh' && e.date >= start && e.date <= end)).co2Kg;

  const rescued = summarize(w.rescued);
  const wasted = summarize(w.wasted);
  const better = w.wastedCount < w.previous.wastedCount;
  const worse = w.wastedCount > w.previous.wastedCount;
  const title = digest ? `Your week in the haunted kitchen, ${shortDate(w.start)} – ${shortDate(w.end)}` : 'This week so far';

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
        {/* The habit worth keeping: food used while it was turning, counted as ghosts that never got to rise. */}
        {w.rescuedCount > 0 && (
          <View className="flex-row items-center gap-2">
            <Art name="trophy" size={32} />
            <Text className="flex-1 text-sm">
              {w.rescuedCount === 1 ? '1 ghost banished' : `${w.rescuedCount} ghosts banished`}: food you used before it could spoil.
            </Text>
          </View>
        )}
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
        <View className="flex-row flex-wrap gap-2">
          {hasActivity(w) && (
            <Button variant="outline" className="h-11" onPress={() => setSharing(true)}>
              <Icon as={Share2} size={16} />
              <Text>Share my week</Text>
            </Button>
          )}
          {digest && (
            <Button variant="ghost" className="h-11" onPress={() => update({ weeklySeen: start })}>
              <Text>Got it</Text>
            </Button>
          )}
        </View>
      </CardContent>
      {sharing && (
        <StorySheet
          open onClose={() => setSharing(false)} w={w} rescued={rescued.text} wasted={wasted.text} co2SavedKg={co2SavedKg}
          text={weekStory(w, (m) => summarize(m).text, { co2SavedKg })}
        />
      )}
    </Card>
  );
}

function Stat({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) {
  return (
    <View role="group" accessibilityLabel={`${label}: ${value}, ${note}`} className={cn('border-border bg-background min-w-36 flex-1 gap-0.5 border-2 border-l-4 p-3', accent)}>
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Text className="text-lg font-bold tabular-nums">{value}</Text>
      <Text className="text-muted-foreground text-xs">{note}</Text>
    </View>
  );
}
