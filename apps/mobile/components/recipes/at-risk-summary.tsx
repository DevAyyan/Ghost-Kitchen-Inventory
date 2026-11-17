import { ItemsLine } from '@/components/food/items-line';
import { Text } from '@/components/ui/text';
import type { Item } from '@/lib/domain/types';
import { useCanHover } from '@/lib/hooks';
import { View } from 'react-native';

/** Before the first search (or offline): what's close to turning, in one line, and what happens next. */
export function AtRiskSummary({ items, offline }: { items: Item[]; offline: boolean }) {
  const canHover = useCanHover();
  return (
    <View className="border-border bg-card gap-3 rounded-lg border p-4">
      <Text role="heading" aria-level={2} className="font-semibold">
        {items.length ? `${items.length} ingredient${items.length === 1 ? ' is' : 's are'} close to turning` : 'Nothing urgent right now'}
      </Text>
      <ItemsLine items={items} />
      <Text className="text-muted-foreground text-sm">
        {!items.length
          ? 'Recipes appear here when food in your fridge starts to turn.'
          : offline
            ? 'Recipes come from your Ghost Kitchen server. Once it is back, they appear here.'
            : `${canHover ? 'Click' : 'Tap'} Find recipes for ones that use these first.`}
      </Text>
    </View>
  );
}
