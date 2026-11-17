import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { CircleCheck, CircleX, LoaderCircle, TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Switch } from '@/components/ui/switch';
import { type Settings, useSettings } from '@/lib/store/settings-store';

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


type BoolSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

/** `invert`: the switch shows the opposite of the stored flag (e.g. "Use AI" over `tesseractOnly`). */
export function ToggleRow({ k, title, sub, invert }: { k: BoolSetting; title: string; sub?: string; invert?: boolean }) {
  const stored = useSettings((st) => st.settings[k]);
  const update = useSettings((st) => st.update);
  const checked = invert ? !stored : stored;
  const toggle = () => update({ [k]: !stored });
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={title}
      className="min-h-12 flex-row items-center gap-3 py-2">
      <View className="flex-1 gap-0.5">
        <Text className="font-medium">{title}</Text>
        {sub ? <Text className="text-muted-foreground text-sm">{sub}</Text> : null}
      </View>
      {/* Visual only: the whole row is the switch, so this one is hidden from assistive tech and the tab order. */}
      <Switch checked={checked} onCheckedChange={toggle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden tabIndex={-1} focusable={false} />
    </Pressable>
  );
}

export function Row({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-center gap-3 py-2">
      <View className="min-w-48 flex-1 gap-0.5">
        <Text className="font-medium">{title}</Text>
        <Text className="text-muted-foreground text-sm">{sub}</Text>
      </View>
      {children}
    </View>
  );
}
