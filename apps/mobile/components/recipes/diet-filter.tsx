import { FilterChip } from '@/components/common/filter-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DIETS, DIET_ORDER, type Diet } from '@/lib/domain/diets';
import { Check } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

/**
 * Multi-select diet chips. Selected diets combine: a recipe must satisfy all of them.
 * `collapsible`: shows only the current diet with a Change button until opened (the Recipes screen, where
 * ten chips would push the recipes down; Settings shows them all).
 */
export function DietFilter({ value, onChange, collapsible }: { value: Diet[]; onChange: (diets: Diet[]) => void; collapsible?: boolean }) {
  const [open, setOpen] = React.useState(!collapsible);
  const toggle = (d: Diet) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-muted-foreground text-sm">
          {value.length === 0 ? 'Diet: no restrictions' : `Diet: ${value.map((d) => DIETS[d].label).join(' + ')}`}
        </Text>
        <View className="flex-row items-center">
          {value.length > 0 && (
            <Pressable onPress={() => onChange([])} accessibilityRole="button" accessibilityLabel="Clear diet filters" className="min-h-11 justify-center px-2">
              <Text className="text-primary text-sm">Clear</Text>
            </Pressable>
          )}
          {collapsible && (
            <Pressable
              onPress={() => setOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={open ? 'Hide diet filters' : 'Change diet filters'}
              className="min-h-11 justify-center px-2">
              <Text className="text-primary text-sm">{open ? 'Done' : 'Change'}</Text>
            </Pressable>
          )}
        </View>
      </View>
      {open && (
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
      )}
    </View>
  );
}
