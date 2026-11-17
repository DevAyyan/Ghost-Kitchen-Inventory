import { Art, type ArtName } from '@/components/halloween/art';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';

/**
 * An empty screen or section: what goes here, and how to fill it. Standing alone it gets a dashed outline;
 * `inCard` drops it, because inside a card a second outline only doubles the border. `art` swaps the
 * line icon for a Halloween illustration, for the empty states people see first.
 */
export function EmptyState({
  icon, art, title, description, action, inCard,
}: { icon: LucideIcon; art?: ArtName; title: string; description?: string; action?: React.ReactNode; inCard?: boolean }) {
  return (
    <View role="status" className={cn('items-center gap-2', inCard ? 'px-2 py-6' : 'border-border rounded-lg border border-dashed px-6 py-10')}>
      {art ? (
        <Art name={art} size={64} className="mb-1" />
      ) : (
        <View className="bg-muted mb-1 h-12 w-12 items-center justify-center rounded-full">
          <Icon as={icon} size={22} className="text-muted-foreground" />
        </View>
      )}
      <Text className="text-center font-semibold">{title}</Text>
      {description ? <Text className="text-muted-foreground max-w-sm text-center text-sm">{description}</Text> : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
