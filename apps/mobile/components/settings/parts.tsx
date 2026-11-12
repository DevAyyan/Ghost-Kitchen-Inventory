import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { CircleCheck, CircleX, LoaderCircle, TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

export function StatusLine({ state, text }: { state: 'ok' | 'bad' | 'warn' | 'pending'; text: string }) {
  const icon = state === 'ok' ? CircleCheck : state === 'bad' ? CircleX : state === 'warn' ? TriangleAlert : LoaderCircle;
  return (
    <View className="flex-row items-start gap-2">
      <Icon
        as={icon}
        size={16}
        className={cn('mt-0.5', state === 'ok' && 'text-stage-fresh', state === 'bad' && 'text-destructive', state === 'warn' && 'text-warning', state === 'pending' && 'text-primary animate-spin')}
      />
      <Text className="flex-1 text-sm">{text}</Text>
    </View>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>{title}</CardTitle></CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  );
}

