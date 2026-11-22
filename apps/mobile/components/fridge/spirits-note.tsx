import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Ghost } from 'lucide-react-native';
import { View } from 'react-native';

/** "2 spirits in here": spoiled food in a compartment, in words. Renders nothing when there is none. */
export function SpiritsNote({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View className="border-stage-spoiled/50 flex-row items-center gap-1 border bg-black/40 px-2 py-0.5">
      <Icon as={Ghost} size={12} className="text-stage-spoiled" />
      <Text className="text-xs">{count === 1 ? '1 spirit in here' : `${count} spirits in here`}</Text>
    </View>
  );
}
