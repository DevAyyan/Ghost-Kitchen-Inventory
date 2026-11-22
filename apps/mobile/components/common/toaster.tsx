import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useLayout } from '@/lib/hooks';
import { useToast } from '@/lib/store/toast';
import { cn } from '@/lib/utils';
import { usePathname } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the fridge screen's floating "Add by photo" button plus its margin (`h-14`, `bottom-4`), plus a gap. */
const FAB_CLEARANCE = 80;

/**
 * Single toast, announced politely to screen readers. Sits above the bottom nav on phones, and above the
 * floating "Add by photo" button on the fridge screen so it never covers it.
 */
export function Toaster() {
  const { message, action, key, hide } = useToast();
  const { isPhone } = useLayout();
  const insets = useSafeAreaInsets();
  const onFridge = usePathname() === '/';

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 items-center px-4"
      style={{ bottom: (isPhone ? 80 + (onFridge ? FAB_CLEARANCE : 0) : 24) + insets.bottom }}
      accessibilityLiveRegion="polite"
      aria-live="polite">
      {message ? (
        <Animated.View key={key} entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(150)}>
          <View className={cn('border-border bg-popover max-w-md flex-row items-center gap-2 border-2 border-b-4 py-1 pl-4 pr-1', !action && 'pr-4')}>
            <Pressable onPress={hide} accessibilityRole="alert" className="flex-1 py-2">
              <Text className="text-center text-sm">{message}</Text>
            </Pressable>
            {action && (
              <Button variant="outline" className="h-11" onPress={() => { hide(); action.onPress(); }}>
                <Text>{action.label}</Text>
              </Button>
            )}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
