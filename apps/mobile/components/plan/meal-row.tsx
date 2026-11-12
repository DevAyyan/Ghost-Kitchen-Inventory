import { ItemChip } from '@/components/plan/item-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Item, PlanEntry } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { ChefHat, CircleCheck, Trash2 } from 'lucide-react-native';
import { Image, View } from 'react-native';

/** One planned meal: what it uses from the fridge, and cook / move / remove. */
export function MealRow({ entry, byId, onCook, onMove, onRemove }: { entry: PlanEntry; byId: Map<string, Item>; onCook: () => void; onMove: () => void; onRemove: () => void }) {
  const used = entry.itemIds.map((id) => byId.get(id)).filter((i): i is Item => !!i && i.status === 'active');
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-3">
        {entry.thumb ? (
          <Image source={{ uri: entry.thumb }} alt="" aria-hidden className="bg-muted h-11 w-11 rounded-md" />
        ) : (
          <View className="bg-muted h-11 w-11 items-center justify-center rounded-md"><Icon as={ChefHat} size={18} className="text-muted-foreground" /></View>
        )}
        <View className="flex-1 gap-0.5">
          <Text className={cn('font-medium', entry.cooked && 'text-muted-foreground line-through')}>{entry.title}</Text>
          {entry.cooked && (
            <View className="flex-row items-center gap-1">
              <Icon as={CircleCheck} size={12} className="text-stage-fresh" />
              <Text className="text-muted-foreground text-xs">Cooked</Text>
            </View>
          )}
        </View>
      </View>
      {used.length > 0 && !entry.cooked && <View className="flex-row flex-wrap gap-1.5">{used.map((i) => <ItemChip key={i.id} item={i} />)}</View>}
      {!entry.cooked && (
        <View className="flex-row flex-wrap gap-1">
          <Button variant="outline" size="sm" className="h-11" onPress={onCook}>
            <Icon as={ChefHat} size={14} /><Text>Cook</Text>
          </Button>
          <Button variant="ghost" size="sm" className="h-11" onPress={onMove}><Text>Move</Text></Button>
          <Button variant="ghost" size="sm" className="h-11" onPress={onRemove} accessibilityLabel={`Remove ${entry.title} from the plan`}>
            <Icon as={Trash2} size={14} /><Text>Remove</Text>
          </Button>
        </View>
      )}
    </View>
  );
}
