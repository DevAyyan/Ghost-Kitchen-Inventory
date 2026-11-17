import { FilterChip } from '@/components/common/filter-chip';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { STAGE_ORDER } from '@/lib/domain/catalog';
import type { Stage } from '@/lib/domain/types';
import { useLayout } from '@/lib/hooks';
import { COLORS } from '@/lib/theme';
import { Flame, Layers } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Gradient } from './gradient';

/** Page background, fully transparent and solid, for the fade that hints more chips are off-screen. */
const FADE = ['hsla(268, 20%, 7%, 0)', COLORS.background] as const;

export type StageFilterValue = 'all' | 'haunting' | Stage;

/** Filter chips with counts. One scrollable line on phones (saves three rows of height), wrapped elsewhere. */
export function StageFilter({
  value, onChange, counts, total, trailing,
}: {
  value: StageFilterValue;
  onChange: (v: StageFilterValue) => void;
  counts: Record<Stage, number>;
  total: number;
  /** Pinned after the chips (the freshness key toggle). On phones it stays put while the chips scroll. */
  trailing?: React.ReactNode;
}) {
  const { isPhone } = useLayout();
  // Fade shows while chips continue past the right edge; it goes once you've scrolled to the end.
  const [scroll, setScroll] = React.useState({ x: 0, view: 0, content: 0 });
  const more = scroll.content > scroll.x + scroll.view + 8;
  const haunting = counts.expiring + counts.rotting + counts.spoiled;
  const chips: { v: StageFilterValue; label: string; icon: typeof Flame; n: number; text?: string }[] = [
    { v: 'all', label: 'All', icon: Layers, n: total },
    { v: 'haunting', label: 'Haunting', icon: Flame, n: haunting, text: 'text-stage-expiring' },
    ...[...STAGE_ORDER].reverse().map((st) => ({
      v: st as StageFilterValue, label: STAGE_STYLE[st].label, icon: STAGE_STYLE[st].icon, n: counts[st], text: STAGE_STYLE[st].text,
    })),
  ];
  const chip = chips.map((c) => {
    const on = value === c.v;
    return (
      <FilterChip
        key={c.v}
        pressed={on}
        onPress={() => onChange(on && c.v !== 'all' ? 'all' : c.v)}
        accessibilityLabel={`${c.label}, ${c.n} items`}>
        <Icon as={c.icon} size={14} className={c.text ?? 'text-muted-foreground'} />
        <Text className="text-sm">{c.label}</Text>
        <Text className="text-muted-foreground text-sm tabular-nums">{c.n}</Text>
      </FilterChip>
    );
  });

  if (isPhone) {
    return (
      <View className="-mx-4 flex-row items-center pr-4">
        <View className="min-w-0 flex-1">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          role="group"
          aria-label="Filter by freshness"
          className="grow-0"
          contentContainerClassName="gap-2 px-4"
          scrollEventThrottle={32}
          onLayout={(e) => { const view = e.nativeEvent.layout.width; setScroll((s) => ({ ...s, view })); }}
          onContentSizeChange={(content) => setScroll((s) => ({ ...s, content }))}
          onScroll={(e) => { const x = e.nativeEvent.contentOffset.x; setScroll((s) => ({ ...s, x })); }}>
          {chip}
        </ScrollView>
        {more && <Gradient colors={FADE} horizontal pointerEvents="none" aria-hidden className="absolute bottom-0 right-0 top-0 w-12" />}
        </View>
        {trailing}
      </View>
    );
  }
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <View role="group" aria-label="Filter by freshness" className="flex-row flex-wrap gap-2">
        {chip}
      </View>
      {trailing}
    </View>
  );
}
