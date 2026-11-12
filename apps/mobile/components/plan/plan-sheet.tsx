import { FilterChip } from '@/components/common/filter-chip';
import { ResponsiveSheet } from '@/components/common/responsive-sheet';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { dayLabel, today } from '@/lib/domain/dates';
import { daysLeft, isCookable, shortRemaining, stageOf } from '@/lib/domain/expiry';
import { planDays } from '@/lib/domain/plan';
import type { IsoDate, Item } from '@/lib/domain/types';
import { useActiveItems } from '@/lib/hooks';
import * as React from 'react';
import { View } from 'react-native';

interface PlanSheetProps {
  open: boolean;
  onClose: () => void;
  heading: string;
  /** Free-text meals ask for a name and which fridge items they use; recipes and moves don't. */
  custom?: boolean;
  initialDate?: IsoDate;
  confirmLabel: string;
  onSave: (v: { date: IsoDate; title: string; itemIds: string[] }) => void;
}

/** Pick a day for a meal (and, for your own meals, a name and the food it uses). */
export function PlanSheet({ open, onClose, heading, custom, initialDate, confirmLabel, onSave }: PlanSheetProps) {
  const now = today();
  const items = useActiveItems();
  const [date, setDate] = React.useState<IsoDate>(initialDate ?? now);
  const [title, setTitle] = React.useState('');
  const [picked, setPicked] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) { setDate(initialDate ?? now); setTitle(''); setPicked([]); }
  }, [open, initialDate, now]);

  // Most urgent first: the point of planning is to use these before they go.
  const usable = items.filter((i) => isCookable(i)).sort((a, b) => a.expires.localeCompare(b.expires)).slice(0, 24);
  const late = usable.filter((i) => picked.includes(i.id) && i.expires < date);
  const canSave = !custom || title.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    onSave({ date, title: title.trim(), itemIds: picked });
    onClose();
  };

  return (
    <ResponsiveSheet
      open={open}
      onClose={onClose}
      title={heading}
      footer={
        <Button className="h-11" onPress={save} disabled={!canSave}>
          <Text>{confirmLabel}</Text>
        </Button>
      }>
      <View className="gap-4">
        {custom && (
          <View className="gap-1.5">
            <Label nativeID="meal-title">Meal</Label>
            <Input aria-labelledby="meal-title" value={title} onChangeText={setTitle} placeholder="e.g. Vegetable soup" maxLength={120} className="h-11" />
          </View>
        )}
        <View className="gap-1.5">
          <Text className="text-sm font-medium">Day</Text>
          <View role="group" aria-label="Day" className="flex-row flex-wrap gap-2">
            {planDays(now).map((d) => (
              <FilterChip key={d} pressed={date === d} onPress={() => setDate(d)}>
                <Text className="text-sm">{dayLabel(d, now)}</Text>
              </FilterChip>
            ))}
          </View>
        </View>
        {custom && usable.length > 0 && (
          <View className="gap-1.5">
            <Text className="text-sm font-medium">Uses from your fridge</Text>
            <View className="flex-row flex-wrap gap-2">
              {usable.map((i) => <ItemToggle key={i.id} item={i} pressed={picked.includes(i.id)} onPress={() => setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))} />)}
            </View>
          </View>
        )}
        {late.length > 0 && (
          <Text className="text-warning text-sm" aria-live="polite">
            {late.map((i) => i.name).join(', ')} will be past {late.length === 1 ? 'its' : 'their'} date by then. Pick an earlier day.
          </Text>
        )}
      </View>
    </ResponsiveSheet>
  );
}

function ItemToggle({ item, pressed, onPress }: { item: Item; pressed: boolean; onPress: () => void }) {
  const s = STAGE_STYLE[stageOf(item)];
  return (
    <FilterChip pressed={pressed} onPress={onPress} accessibilityLabel={`${item.name}, ${s.label}, ${shortRemaining(daysLeft(item))}`}>
      <Icon as={s.icon} size={14} className={s.text} />
      <Text className="text-sm">{item.name}</Text>
      <Text className="text-muted-foreground text-xs">{shortRemaining(daysLeft(item))}</Text>
    </FilterChip>
  );
}
