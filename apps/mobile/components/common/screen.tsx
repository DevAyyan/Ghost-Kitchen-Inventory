import { Text } from '@/components/ui/text';
import { isApiConfigured } from '@/lib/api';
import { useServer } from '@/lib/store/server-store';
import { cn } from '@/lib/utils';
import { WifiOff } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Icon } from '@/components/ui/icon';

interface ScreenProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Extra bottom space so content clears a floating action button. */
  fabClearance?: boolean;
  scroll?: boolean;
  /** Lets a screen scroll itself, e.g. back to the top when the page of results changes. */
  scrollRef?: React.Ref<ScrollView>;
  /**
   * The screen's main job needs the server (scanning, review lookups, recipes): spell out what being
   * offline means here. Elsewhere the top bar's "Offline" pill is enough.
   */
  needsServer?: boolean;
  /**
   * Set the title in the gothic display face. Only for the graveyard: on working screens it costs space
   * and reads heavy next to data, and the fridge's own effects already carry the theme.
   */
  display?: boolean;
}

/**
 * Lets something inside the page keep itself in view after the layout above the reader changes. Used by
 * storage doors: closing a tall section shrinks it, which would leave the reader past its bottom, looking
 * at whatever came next instead of the door they just shut.
 */
export const ScreenScroll = React.createContext<{ reveal: (view: View | null) => void } | null>(null);

/** Page scaffold: one h1 per screen, optional actions, offline banner, max content width on desktop. */
export function Screen({ title, description, actions, children, fabClearance, scroll = true, scrollRef, needsServer, display }: ScreenProps) {
  const unreachable = useServer((s) => s.reachable === false) && isApiConfigured() && !!needsServer;
  const scroller = React.useRef<ScrollView | null>(null);
  const offset = React.useRef(0);
  const setScroller = React.useCallback((node: ScrollView | null) => {
    scroller.current = node;
    if (typeof scrollRef === 'function') scrollRef(node);
    else if (scrollRef) (scrollRef as React.MutableRefObject<ScrollView | null>).current = node;
  }, [scrollRef]);
  const scrollApi = React.useMemo(() => ({
    reveal: (view: View | null) => {
      const sv = scroller.current as unknown as View | null;
      if (!view || !sv) return;
      // Window coordinates work the same on web and Android; only scroll if its top went above the view.
      sv.measureInWindow((_x, svTop) => {
        view.measureInWindow((_vx, viewTop) => {
          const gap = viewTop - svTop;
          if (gap >= 0) return;
          scroller.current?.scrollTo({ y: Math.max(0, offset.current + gap - 12), animated: true });
        });
      });
    },
  }), []);
  const content = (
    <View className="mx-auto w-full max-w-6xl gap-4">
      {unreachable && (
        <View role="status" className="border-warning/60 bg-warning/10 flex-row items-center gap-2 rounded-lg border px-3 py-2">
          <Icon as={WifiOff} size={16} className="text-warning" />
          <Text className="flex-1 text-sm">Can't reach your Ghost Kitchen server, so this needs it back first. Your fridge still works offline.</Text>
        </View>
      )}
      {/* Title and actions share a row; the description runs full width under both, so a button never
          squeezes it into a narrow column. */}
      <View className="gap-1">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <Text role="heading" aria-level={1} className={cn('min-w-0 shrink', display ? 'font-display text-4xl leading-10' : 'text-2xl font-bold tracking-tight')}>
            {title}
          </Text>
          {actions ? <View className="flex-row flex-wrap items-center gap-2">{actions}</View> : null}
        </View>
        {description ? <Text className="text-muted-foreground max-w-prose text-sm">{description}</Text> : null}
      </View>
      {children}
    </View>
  );
  if (!scroll) return <View className="flex-1 px-4 pt-4">{content}</View>;
  return (
    <ScrollView
      ref={setScroller}
      onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={32}
      className="flex-1"
      contentContainerClassName={cn('px-4 pt-4 md:px-6 md:pt-6', fabClearance ? 'pb-28' : 'pb-10')}
      keyboardShouldPersistTaps="handled">
      <ScreenScroll.Provider value={scrollApi}>{content}</ScreenScroll.Provider>
    </ScrollView>
  );
}
