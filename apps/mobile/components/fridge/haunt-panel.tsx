import { FoodPhoto } from '@/components/food/food-photo';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { LEDGER_DAYS, useSummarize, withinLedgerWindow } from '@/lib/rates';
import { daysLeft, isAtRisk, isHaunting, remainingText, stageOf } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { useApp } from '@/lib/store/app-store';
import { cn } from '@/lib/utils';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

/** Desktop side panel listing what needs attention, plus 30-day money summary. */
export function HauntPanel({ items, onSelect }: { items: Item[]; onSelect: (id: string) => void }) {
  const router = useRouter();
  const events = useApp((s) => s.events).filter((e) => withinLedgerWindow(e.date));
  const summarize = useSummarize();
  const risky = items.filter((i) => isHaunting(stageOf(i))).sort((a, b) => daysLeft(a) - daysLeft(b));
  const atRisk = summarize(items.filter((i) => isAtRisk(stageOf(i))).map((i) => ({ minor: Math.round(i.priceMinor * i.fraction), currency: i.currency })));
  const avoided = summarize(events.filter((e) => e.type === 'used' && e.stage !== 'fresh'));
  const wasted = summarize(events.filter((e) => e.type === 'discarded'));

  return (
    <ScrollView contentContainerClassName="gap-3 p-4">
      <Text role="heading" aria-level={2} className="text-lg font-semibold">Haunting now</Text>
      <Text className="text-muted-foreground text-sm">
        {risky.length} items need attention · {atRisk.text} at risk
      </Text>
      <View role="list" className="gap-2">
        {risky.length === 0 && <Text className="text-muted-foreground text-sm">Nothing haunting. Nice.</Text>}
        {risky.map((i) => {
          const st = stageOf(i);
          const s = STAGE_STYLE[st];
          return (
            <Pressable
              key={i.id}
              role="listitem"
              onPress={() => onSelect(i.id)}
              accessibilityRole="button"
              accessibilityLabel={`${i.name}, ${s.label}, ${remainingText(daysLeft(i))}`}
              className={cn('border-border bg-card web:hover:bg-accent min-h-11 flex-row items-center gap-3 rounded-md border border-l-4 px-3 py-2', s.border)}>
              <FoodPhoto photoUri={i.photoUri} category={i.category} stage={st} size="sm" />
              <View className="flex-1">
                <Text className="text-sm font-medium">{i.name}</Text>
                <View className="flex-row items-center gap-1">
                  <Icon as={s.icon} size={12} className={s.text} />
                  <Text className="text-muted-foreground text-xs">{s.label} · {remainingText(daysLeft(i))}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Button onPress={() => router.navigate({ pathname: '/recipes', params: { summon: '1' } })}>
        <Icon as={Sparkles} size={16} className="text-primary-foreground" />
        <Text>Summon rescue recipes</Text>
      </Button>
      <Separator className="my-2" />
      <Text role="heading" aria-level={2} className="font-semibold">Last {LEDGER_DAYS} days</Text>
      <Row label="Waste avoided" value={avoided.text} className="text-stage-fresh" />
      <Row label="Wasted" value={wasted.text} className="text-destructive" />
    </ScrollView>
  );
}

function Row({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className={cn('text-sm font-semibold tabular-nums', className)}>{value}</Text>
    </View>
  );
}
