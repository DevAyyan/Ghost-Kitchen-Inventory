import { StepIn } from '@/components/common/pixel-motion';
import { useIsFocused } from 'expo-router';
import { Art, type ArtName } from '@/components/halloween/art';
import { Text } from '@/components/ui/text';
import { isApiConfigured } from '@/lib/api';
import { useServer } from '@/lib/store/server-store';
import { useSettings } from '@/lib/store/settings-store';
import { cn } from '@/lib/utils';
import { Sparkles, WifiOff } from 'lucide-react-native';
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
  /** A small Halloween illustration before the title. Decorative; the title says what the screen is. */
  art?: ArtName;
}

/** Page scaffold: one h1 per screen, optional actions, offline banner, max content width on desktop. */
export function Screen({ title, description, actions, children, fabClearance, scroll = true, scrollRef, needsServer, display, art }: ScreenProps) {
  const demoMode = useSettings((s) => s.settings.demoMode);
  const serverDown = useServer((s) => s.reachable === false);
  const demo = demoMode && !!needsServer;
  const unreachable = !demoMode && serverDown && isApiConfigured() && !!needsServer;
  // Each visit to the screen replays the step-in; the content isn't remounted, so nothing typed is lost.
  const focused = useIsFocused();
  const [visits, setVisits] = React.useState(0);
  React.useEffect(() => { if (focused) setVisits((v) => v + 1); }, [focused]);
  const content = (
    <StepIn trigger={visits} className="mx-auto w-full max-w-6xl gap-4">
      {demo && (
        <View role="status" className="border-primary/60 bg-primary/10 flex-row items-center gap-2 rounded-lg border px-3 py-2">
          <Icon as={Sparkles} size={16} className="text-primary" />
          <Text className="flex-1 text-sm">Demo mode: answers here are recorded samples, not a live reading. Turn it off in Settings.</Text>
        </View>
      )}
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
          <View className="min-w-0 shrink flex-row items-center gap-2">
            {art ? <Art name={art} size={32} /> : null}
            <Text role="heading" aria-level={1} className={cn('min-w-0 shrink', display ? 'font-display pb-2 text-4xl leading-10' : 'font-display text-2xl tracking-tight')}>
              {title}
            </Text>
          </View>
          {actions ? <View className="flex-row flex-wrap items-center gap-2">{actions}</View> : null}
        </View>
        {description ? <Text className="text-muted-foreground max-w-prose text-sm">{description}</Text> : null}
      </View>
      {children}
    </StepIn>
  );
  if (!scroll) return <View className="flex-1 px-4 pt-4">{content}</View>;
  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      contentContainerClassName={cn('px-4 pt-4 md:px-6 md:pt-6', fabClearance ? 'pb-28' : 'pb-10')}
      keyboardShouldPersistTaps="handled">
      {content}
    </ScrollView>
  );
}
