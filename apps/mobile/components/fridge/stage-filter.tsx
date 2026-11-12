import { FilterChip } from '@/components/common/filter-chip';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { STAGE_ORDER } from '@/lib/domain/catalog';
import type { Stage } from '@/lib/domain/types';
import { useLayout } from '@/lib/hooks';
import { Flame, Layers } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

export type StageFilterValue = 'all' | 'haunting' | Stage;

/** Filter chips with counts. One scrollable line on phones (saves three rows of height), wrapped elsewhere. */
export function StageFilter({
  value, onChange, counts, total,
}: { value: StageFilterValue; onChange: (v: StageFilterValue) => void; counts: Record<Stage, number>; total: number }) {
  const { isPhone } = useLayout();
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        role="group"
        aria-label="Filter by freshness"
        className="-mx-4 grow-0"
        contentContainerClassName="gap-2 px-4">
        {chip}
      </ScrollView>
    );
  }
  return (
    <View role="group" aria-label="Filter by freshness" className="flex-row flex-wrap gap-2">
      {chip}
    </View>
  );
}
