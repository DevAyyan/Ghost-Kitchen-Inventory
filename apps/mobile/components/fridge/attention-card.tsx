import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import type { Item } from '@/lib/domain/types';
import { CalendarClock, Ghost } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

interface AttentionCardProps {
  spoiled: Item[];
  estimated: Item[];
  onBury: () => void;
  onCheck: () => void;
}

/** One card for everything that needs a decision, instead of a stack of banners above the fridge. */
export function AttentionCard({ spoiled, estimated, onBury, onCheck }: AttentionCardProps) {
  if (spoiled.length === 0 && estimated.length === 0) return null;
  return (
    <View role="region" aria-label="Needs attention" className="border-border bg-card rounded-lg border">
      {spoiled.length > 0 && (
        <Row
          icon={<Icon as={Ghost} size={22} className="text-stage-spoiled" />}
          title={`${spoiled.length} spoiled`}
          detail={spoiled.map((i) => i.name).join(', ')}
          action={`Bury ${spoiled.length}`}
          onPress={onBury}
        />
      )}
      {spoiled.length > 0 && estimated.length > 0 && <Separator />}
      {estimated.length > 0 && (
        <Row
          icon={<Icon as={CalendarClock} size={22} className="text-warning" />}
          title={`${estimated.length} ${estimated.length === 1 ? 'date' : 'dates'} to check`}
          detail={estimated.map((i) => i.name).join(', ')}
          action={`Check ${estimated.length === 1 ? 'it' : 'first'}`}
          onPress={onCheck}
        />
      )}
    </View>
  );
}

function Row({
  icon, title, detail, action, onPress,
}: { icon: React.ReactNode; title: string; detail: string; action: string; onPress: () => void }) {
  return (
    // Short titles keep the button on the same row, even at 320 px.
    <View className="flex-row items-center gap-3 p-3">
      {icon}
      <View className="min-w-0 flex-1">
        <Text className="font-semibold">{title}</Text>
        <Text className="text-muted-foreground text-sm" numberOfLines={2}>{detail}</Text>
      </View>
      <Button variant="outline" className="h-11" onPress={onPress}>
        <Text>{action}</Text>
      </Button>
    </View>
  );
}
