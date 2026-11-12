import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { daysLeft, shortRemaining, stageOf } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { View } from 'react-native';

/** A fridge item as a small chip: stage colour, icon and label together, never colour alone. */
export function ItemChip({ item }: { item: Item }) {
  const s = STAGE_STYLE[stageOf(item)];
  return (
    <View accessibilityLabel={`${item.name}, ${s.label}, ${shortRemaining(daysLeft(item))}`} className={cn('flex-row items-center gap-1 rounded-full border px-2 py-0.5', s.border)}>
      <Icon as={s.icon} size={12} className={s.text} />
      <Text className="text-xs">{item.name} · {shortRemaining(daysLeft(item))}</Text>
    </View>
  );
}
