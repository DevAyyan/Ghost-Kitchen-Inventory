import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { currencyInfo } from '@/lib/currency/catalog';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

/** Tappable currency: symbol, code, optional name, and a CHECK flag when detection is uncertain. */
export function CurrencyChip({
  code, onPress, needsCheck, showName = true, prefix,
}: { code: string; onPress: () => void; needsCheck?: boolean; showName?: boolean; prefix?: string }) {
  const c = currencyInfo(code);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${prefix ? `${prefix}: ` : ''}${c.name} (${c.code})${needsCheck ? ', please check' : ''}. Change`}
      className={cn(
        'border-border bg-secondary web:hover:bg-accent h-11 flex-row items-center gap-2 self-start rounded-full border px-3',
        needsCheck && 'border-warning'
      )}>
      {prefix ? <Text className="text-muted-foreground text-sm">{prefix}</Text> : null}
      <Text className="text-primary font-semibold">{c.symbol}</Text>
      <Text className="font-semibold">{c.code}</Text>
      {showName && <Text className="text-muted-foreground text-sm">{c.name}</Text>}
      {needsCheck && (
        <View className="bg-warning rounded px-1.5">
          <Text className="text-background text-[10px] font-bold">CHECK</Text>
        </View>
      )}
      <Icon as={ChevronDown} size={14} className="text-muted-foreground" />
    </Pressable>
  );
}
