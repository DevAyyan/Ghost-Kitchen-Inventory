import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLayout } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react-native';
import * as React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ResponsiveSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Disable the internal ScrollView when the content scrolls itself (e.g. a FlatList). */
  scroll?: boolean;
}

/**
 * Bottom sheet on phones, right-side sheet on tablet/desktop (design contract).
 * Built on RN Modal so the Android back button closes it via onRequestClose.
 */
export function ResponsiveSheet({ open, onClose, title, description, children, footer, scroll = true }: ResponsiveSheetProps) {
  const { isPhone } = useLayout();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;

  return (
    <Modal visible={open} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      <View className={cn('flex-1', isPhone ? 'justify-end' : 'flex-row justify-end')}>
        <Pressable
          className="absolute inset-0 bg-black/60"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          aria-label={title}
          className={cn(
            // Pixel frame: a lit edge facing the page, with a dark line just inside it.
            'border-border bg-popover border-foreground/25',
            isPhone ? 'max-h-[85%] border-t-4' : 'h-full w-full max-w-md border-l-4'
          )}
          style={{ paddingBottom: Math.max(insets.bottom, 16), paddingTop: isPhone ? 0 : insets.top }}>
          {isPhone && <View className="bg-muted-foreground/40 mx-auto mt-2 h-1.5 w-12" />}
          <View className="border-border flex-row items-start gap-3 border-b-2 px-4 pb-2 pt-3">
            <View className="flex-1 gap-1">
              <Text role="heading" aria-level={2} className="font-display text-xl">
                {title}
              </Text>
              {description ? <Text className="text-muted-foreground text-sm">{description}</Text> : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              className="active:bg-accent border-border -mr-2 h-11 w-11 items-center justify-center border-2 border-b-4 active:border-b-2">
              <Icon as={X} size={20} className="text-muted-foreground" />
            </Pressable>
          </View>
          <Body
            className={scroll ? undefined : 'flex-1'}
            contentContainerClassName={scroll ? 'gap-4 px-4 pb-4' : undefined}
            keyboardShouldPersistTaps="handled">
            {children}
          </Body>
          {footer ? <View className="border-border flex-row flex-wrap gap-2 border-t-2 px-4 pt-3">{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}
