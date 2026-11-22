import { Bob, StepIn } from '@/components/common/pixel-motion';
import { Art } from '@/components/halloween/art';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { samePath, TOUR, tourAdvance, tourBack, tourNext } from '@/lib/domain/tour';
import { useLayout } from '@/lib/hooks';
import { useScan } from '@/lib/store/scan-store';
import { useTour } from '@/lib/store/tour-store';
import { cn } from '@/lib/utils';
import { usePathname, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, X } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The guided tour's card, just under the top bar so it never covers toasts or the review footer. It isn't
 * modal: the app stays fully usable, and doing what a stop asks moves the tour on. It never moves focus,
 * so a screen reader user isn't pulled away from what they're doing; the title is announced instead.
 */
export function TourCard() {
  const { step, folded, go, end, setFolded } = useTour();
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { isPhone } = useLayout();
  const hasDraft = useScan((s) => !!s.draft);

  React.useEffect(() => {
    if (step === null) return;
    const next = tourAdvance(step, path);
    if (next !== null) go(next);
  }, [path, step, go]);

  if (step === null) return null;
  const s = TOUR[step]!;
  const here = samePath(path, s.route);
  const nextStep = tourNext(step, hasDraft);
  const goTo = (n: number) => { go(n); const r = TOUR[n]!.route; if (!samePath(path, r)) router.navigate(r as never); };
  const top = insets.top + 56 + 8;

  if (folded) {
    return (
      <View pointerEvents="box-none" className="absolute inset-x-0 items-end px-4" style={{ top }}>
        <Pressable
          onPress={() => setFolded(false)}
          accessibilityRole="button"
          accessibilityLabel={`Guided tour, stop ${step + 1} of ${TOUR.length}: ${s.title}. Show`}
          className="bg-popover border-primary h-11 flex-row items-center gap-2 border-2 border-b-4 px-3 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
          <Art name="ghost" size={20} />
          <Text className="text-sm tabular-nums">Tour {step + 1} of {TOUR.length}</Text>
          <Icon as={ChevronDown} size={16} />
        </Pressable>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" className={cn('absolute inset-x-0 px-4', !isPhone && 'items-end')} style={{ top }}>
      <StepIn trigger={step} role="region" aria-label="Guided tour" className="bg-popover border-primary w-full max-w-md gap-2 border-2 border-b-4 p-3">
        <View className="flex-row items-center gap-2">
          <Bob><Art name="ghost" size={24} /></Bob>
          <Text aria-live="polite" role="heading" aria-level={2} className="flex-1 font-semibold">{s.title}</Text>
          <Text className="text-muted-foreground text-xs tabular-nums">{step + 1} of {TOUR.length}</Text>
          <Pressable onPress={() => setFolded(true)} accessibilityRole="button" accessibilityLabel="Fold the tour away" className="active:bg-accent h-11 w-11 items-center justify-center">
            <Icon as={ChevronUp} size={16} />
          </Pressable>
          <Pressable onPress={end} accessibilityRole="button" accessibilityLabel="End the tour" className="active:bg-accent h-11 w-11 items-center justify-center">
            <Icon as={X} size={16} />
          </Pressable>
        </View>
        {/* Pip per stop, like the welcome sheet's. */}
        <View className="flex-row gap-1" aria-hidden>
          {TOUR.map((t, n) => <View key={t.id} className={cn('h-1 flex-1', n <= step ? 'bg-primary' : 'bg-muted')} />)}
        </View>
        <Text className="text-sm">{s.body}</Text>
        {s.doIt && here && <Text className="text-primary text-sm">{s.doIt}</Text>}
        <View className="flex-row flex-wrap gap-2">
          {!here ? (
            <Button className="h-11" onPress={() => goTo(step)}><Text>Show me</Text></Button>
          ) : nextStep !== null ? (
            <Button className="h-11" variant={s.doIt ? 'outline' : 'default'} onPress={() => goTo(nextStep)}>
              <Text>{s.doIt ? 'Skip this step' : 'Next'}</Text>
            </Button>
          ) : (
            <Button className="h-11" onPress={() => { end(); router.navigate('/'); }}><Text>Finish</Text></Button>
          )}
          {step > 0 && <Button variant="ghost" className="h-11" onPress={() => goTo(tourBack(step))}><Text>Back</Text></Button>}
        </View>
      </StepIn>
    </View>
  );
}
