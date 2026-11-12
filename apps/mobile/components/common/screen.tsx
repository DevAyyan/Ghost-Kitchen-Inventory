import { Text } from '@/components/ui/text';
import { isApiConfigured } from '@/lib/api';
import { useServer } from '@/lib/store/server-store';
import { cn } from '@/lib/utils';
import { WifiOff } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Icon } from '@/components/ui/icon';

interface ScreenProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Extra bottom space so content clears a floating action button. */
  fabClearance?: boolean;
  scroll?: boolean;
  /** Lets a screen scroll itself, e.g. back to the top when the page of results changes. */
  scrollRef?: React.Ref<ScrollView>;
}

/** Page scaffold: one h1 per screen, optional actions, offline banner, max content width on desktop. */
export function Screen({ title, description, actions, children, fabClearance, scroll = true, scrollRef }: ScreenProps) {
  const unreachable = useServer((s) => s.reachable === false) && isApiConfigured();
  const content = (
    <View className="mx-auto w-full max-w-6xl gap-4">
      {unreachable && (
        <View role="status" className="border-warning/60 bg-warning/10 flex-row items-center gap-2 rounded-lg border px-3 py-2">
          <Icon as={WifiOff} size={16} className="text-warning" />
          <Text className="flex-1 text-sm">Can't reach your Ghost Kitchen server. Your fridge works offline; scanning and recipes need the server.</Text>
        </View>
      )}
      <View className="flex-row flex-wrap items-end justify-between gap-3">
        <View className="min-w-56 flex-1 gap-1">
          <Text role="heading" aria-level={1} className="font-display text-4xl leading-10">
            {title}
          </Text>
          {description ? <Text className="text-muted-foreground text-sm">{description}</Text> : null}
        </View>
        {actions ? <View className="flex-row flex-wrap items-center gap-2">{actions}</View> : null}
      </View>
      {children}
    </View>
  );
  if (!scroll) return <View className="flex-1 px-4 pt-4">{content}</View>;
  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      contentContainerClassName={cn('px-4 pt-4 md:px-6 md:pt-6', fabClearance ? 'pb-28' : 'pb-10')}
      keyboardShouldPersistTaps="handled">
      {content}
    </ScrollView>
  );
}
