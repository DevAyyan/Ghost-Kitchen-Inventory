import { Art } from '@/components/halloween/art';
import { Text } from '@/components/ui/text';
import type { Badge } from '@/lib/domain/profile';
import { cn } from '@/lib/utils';
import { View } from 'react-native';

/** Earned and still-to-earn badges, with progress. Used on the profile and the ledger. */
export function BadgeGrid({ list }: { list: Badge[] }) {
  return (
    <View role="list" className="flex-row flex-wrap gap-3">
      {list.map((b) => (
        <View
          key={b.id}
          role="listitem"
          accessible
          accessibilityLabel={`${b.title}: ${b.how}. ${b.earned ? 'Earned' : `${b.progress.have} of ${b.progress.need}`}`}
          className={cn('border-border bg-background min-w-36 flex-1 items-center gap-1 border-2 p-3', !b.earned && 'opacity-60')}>
          <View className={cn(!b.earned && 'opacity-40')}><Art name={b.art} size={40} /></View>
          <Text className="text-center font-semibold">{b.title}</Text>
          <Text className="text-muted-foreground text-center text-xs">{b.how}</Text>
          <Text className={cn('text-xs', b.earned ? 'text-primary' : 'text-muted-foreground')}>
            {b.earned ? 'Earned' : `${b.progress.have} of ${b.progress.need}`}
          </Text>
        </View>
      ))}
    </View>
  );
}
