import { Text } from '@/components/ui/text';
import { useLayout } from '@/lib/hooks';
import { useToast } from '@/lib/store/toast';
import { cn } from '@/lib/utils';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Single toast, announced politely to screen readers. Sits above the bottom nav on phones. */
export function Toaster() {
  const { message, key, hide } = useToast();
  const { isPhone } = useLayout();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 items-center px-4"
      style={{ bottom: (isPhone ? 80 : 24) + insets.bottom }}
      accessibilityLiveRegion="polite"
      aria-live="polite">
      {message ? (
        <Animated.View key={key} entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(150)}>
          <Pressable
            onPress={hide}
            accessibilityRole="alert"
            className={cn('border-border bg-popover max-w-md rounded-lg border px-4 py-3')}>
            <Text className="text-center text-sm">{message}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}
