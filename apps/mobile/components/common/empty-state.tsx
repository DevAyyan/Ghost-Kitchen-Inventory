import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

export function EmptyState({
  icon, title, description, action,
}: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <View role="status" className="border-border items-center gap-2 rounded-lg border border-dashed px-6 py-10">
      <View className="bg-muted mb-1 h-12 w-12 items-center justify-center rounded-full">
        <Icon as={icon} size={22} className="text-muted-foreground" />
      </View>
      <Text className="text-center font-semibold">{title}</Text>
      {description ? <Text className="text-muted-foreground max-w-sm text-center text-sm">{description}</Text> : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
