import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/currency/money';
import { ZONES } from '@/lib/domain/catalog';
import { shortDate } from '@/lib/domain/dates';
import { isCookable } from '@/lib/domain/expiry';
import { planMove } from '@/lib/domain/storage';
import { suggestMove } from '@/lib/domain/suggest';
import type { Item, Stage } from '@/lib/domain/types';
import { useApp } from '@/lib/store/app-store';
import { toast } from '@/lib/store/toast';
import { CircleCheck, Snowflake, Trash2 } from 'lucide-react-native';
import { View } from 'react-native';

/**
 * The two things people do most, one tap away at the top of an item: it's gone (eaten) or binned. Logging
 * has to be this quick, or the fridge stops matching the real one. Below it, the one storage move worth
 * making, if any. Partial use, dates and moving by hand stay further down.
 */
export function QuickActions({ item, stage, onDone }: { item: Item; stage: Stage; onDone: () => void }) {
  const consumeItem = useApp((s) => s.consumeItem);
  const discardItem = useApp((s) => s.discardItem);
  const moveItem = useApp((s) => s.moveItem);
  const suggestion = suggestMove(item);
  const cookable = isCookable(item);

  const usedAll = () => {
    const res = consumeItem(item.id, item.qty * item.fraction);
    if (!res) return;
    toast(`${item.name} used up${res.stage !== 'fresh' && res.value > 0 ? ` · ${formatMoney(res.value, item.currency)} rescued` : ''}`);
    onDone();
  };
  const binned = () => {
    const res = discardItem(item.id);
    if (res) toast(`${item.name} buried · ${formatMoney(res.value, res.currency)} lost`);
    onDone();
  };
  const move = () => {
    if (!suggestion) return;
    const plan = planMove(item, suggestion.to);
    if (!plan.ok) { toast(plan.reason); return; }
    moveItem(item.id, plan.to, plan.expires, plan.shelfDays, false);
    toast(`${item.name} moved to the ${ZONES[plan.to].label.toLowerCase()} · keeps until ${shortDate(plan.expires)}`);
  };

  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        {cookable && (
          <Button className="h-11 flex-1" onPress={usedAll} accessibilityHint="Marks all that's left as eaten">
            <Icon as={CircleCheck} size={16} className="text-primary-foreground" />
            <Text>Used it all</Text>
          </Button>
        )}
        <Button
          variant={stage === 'spoiled' ? 'destructive' : 'outline'}
          className="h-11 flex-1"
          onPress={binned}
          accessibilityHint="Throws away what's left and counts it as wasted">
          <Icon as={Trash2} size={16} className={stage === 'spoiled' ? 'text-white' : undefined} />
          <Text>Binned it</Text>
        </Button>
      </View>
      {suggestion && (
        <View className="border-border flex-row items-center gap-3 rounded-lg border p-2 pl-3">
          <Icon as={Snowflake} size={18} className={suggestion.kind === 'save' ? 'text-stage-expiring' : 'text-muted-foreground'} />
          <View className="min-w-0 flex-1">
            <Text className="font-semibold" numberOfLines={1}>{suggestion.title}</Text>
            <Text className="text-muted-foreground text-sm">{suggestion.detail}{suggestion.note ? `. ${suggestion.note}` : ''}</Text>
          </View>
          <Button variant="outline" className="h-11 px-3" onPress={move}>
            <Text>{suggestion.kind === 'save' ? 'Freeze' : 'Move'}</Text>
          </Button>
        </View>
      )}
    </View>
  );
}
