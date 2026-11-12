import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Stage } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { View } from 'react-native';
import { STAGE_STYLE } from './stage-style';

/** Icon + label pill. Never rely on colour alone (NFR-A11Y-1). */
export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  const s = STAGE_STYLE[stage];
  return (
    <View className={cn('flex-row items-center gap-1 self-start rounded-full border px-2 py-0.5', s.border, s.tint, className)}>
      <Icon as={s.icon} size={12} className={s.text} />
      <Text className={cn('text-xs font-semibold', s.text)}>{s.label}</Text>
    </View>
  );
}
