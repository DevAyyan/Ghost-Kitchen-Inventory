import { FilterChip } from '@/components/common/filter-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DIETS, DIET_ORDER, type Diet } from '@/lib/domain/diets';
import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

/** Multi-select diet chips. Selected diets combine: a recipe must satisfy all of them. */
export function DietFilter({ value, onChange }: { value: Diet[]; onChange: (diets: Diet[]) => void }) {
  const toggle = (d: Diet) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-muted-foreground text-sm">
          {value.length === 0 ? 'Diet: no restrictions' : `Diet: ${value.map((d) => DIETS[d].label).join(' + ')}`}
        </Text>
        {value.length > 0 && (
          <Pressable onPress={() => onChange([])} accessibilityRole="button" className="min-h-11 justify-center px-2">
            <Text className="text-primary text-sm">Clear</Text>
          </Pressable>
        )}
      </View>
      <View role="group" aria-label="Diet filters" className="flex-row flex-wrap gap-2">
        {DIET_ORDER.map((d) => {
          const on = value.includes(d);
          return (
            <FilterChip key={d} pressed={on} onPress={() => toggle(d)} accessibilityLabel={`${DIETS[d].label}${on ? ', on' : ''}`}>
              {on && <Icon as={Check} size={14} className="text-primary" />}
              <Text className="text-sm">{DIETS[d].label}</Text>
            </FilterChip>
          );
        })}
      </View>
    </View>
  );
}
