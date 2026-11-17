import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { STAGE_ORDER } from '@/lib/domain/catalog';
import { daysLeft, stageOf } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { View } from 'react-native';
import { FoodPhoto } from './food-photo';

/**
 * A short summary of a set of food instead of a wall of pills: the most urgent few as small photos and
 * names, then "+5". The stage colour appears once, on the worst stage's icon, so it keeps its meaning.
 */
export function ItemsLine({ items, max = 3 }: { items: Item[]; max?: number }) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => STAGE_ORDER.indexOf(stageOf(a)) - STAGE_ORDER.indexOf(stageOf(b)) || daysLeft(a) - daysLeft(b));
  const worst = STAGE_STYLE[stageOf(sorted[0]!)];
  const shown = sorted.slice(0, max);
  const rest = sorted.length - shown.length;
  return (
    <View className="flex-row items-center gap-2" accessible accessibilityLabel={sorted.map((i) => i.name).join(', ')}>
      <Icon as={worst.icon} size={16} className={worst.text} />
      <View className="flex-row">
        {shown.map((i, n) => (
          <View key={i.id} className={n > 0 ? '-ml-2' : undefined}>
            <FoodPhoto photoUri={i.photoUri} category={i.category} name={i.name} size="sm" className="border-card h-8 w-8 border-2" />
          </View>
        ))}
      </View>
      <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>
        {shown.map((i) => i.name).join(', ')}
        {rest > 0 ? <Text className="text-muted-foreground"> +{rest}</Text> : null}
      </Text>
    </View>
  );
}
