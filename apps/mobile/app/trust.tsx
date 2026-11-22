import { Screen } from '@/components/common/screen';
import { STAGE_MEANING } from '@/components/fridge/stage-key';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CATEGORY_LABEL, HIGH_RISK_CATEGORIES, STAGE_META } from '@/lib/domain/catalog';
import { MAX_SNIFFS, SNIFF_DAYS } from '@/lib/domain/expiry';
import { MIN_FACTOR, MIN_SAMPLES } from '@/lib/domain/learning';
import type { Stage } from '@/lib/domain/types';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STAGES: Stage[] = ['fresh', 'aging', 'expiring', 'rotting', 'spoiled'];

/**
 * How the app decides what's safe, in plain words. Built from the same constants the rules use
 * (catalog, expiry, learning), so the page can't drift from what the app actually does.
 */
export default function TrustScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const highRisk = [...HIGH_RISK_CATEGORIES].map((c) => CATEGORY_LABEL[c].toLowerCase());
  const list = `${highRisk.slice(0, -1).join(', ')} and ${highRisk.at(-1)}`;
  const rules: { title: string; body: string }[] = [
    { title: 'Estimates lean short', body: 'Shelf life follows food-safety guidance such as the USDA FoodKeeper and errs on the short side. Without AI, the app uses deliberately short estimates for each kind of food. Food photographed without a receipt counts only half its usual shelf life, because we don\'t know when it was bought.' },
    { title: 'An estimate says so', body: 'Every estimated date is marked "est." until you check it against the package. Checking is optional, and the reminder stays until you do.' },
    { title: `${list[0]!.toUpperCase()}${list.slice(1)} are always high risk`, body: 'Whatever the AI says. They never go in the pantry, and once past their date they go straight to spoiled, with no "rotting" grace days.' },
    { title: 'Spoiled food never goes in a recipe', body: 'Nor does high-risk food past its date. The app doesn\'t even send it to the server when looking for recipes, and the "cook tonight" idea leaves it out too.' },
    { title: 'Diet filters fail closed', body: 'If an ingredient can\'t be checked against your diet, the recipe is hidden, not shown with a guess.' },
    { title: 'The AI can\'t loosen any of this', body: 'Its answers are checked against these rules on the server. It can shorten a date, never push food past the floors above.' },
    { title: '"Still looks fine" has limits', body: `Only for low-risk food, at most ${MAX_SNIFFS} times per item, and it adds just ${SNIFF_DAYS} days, so the item stays marked as expiring.` },
    { title: 'Learning only shortens dates', body: `Mark food as "went off early" ${MIN_SAMPLES} times and future estimates for it get shorter, never longer, and never below ${Math.round(MIN_FACTOR * 100)}% of the usual.` },
  ];

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <View className="border-border h-14 flex-row items-center gap-2 border-b px-2">
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Back" className="active:bg-accent h-11 w-11 items-center justify-center rounded-md">
          <Icon as={ArrowLeft} size={20} />
        </Pressable>
      </View>
      <Screen title="How dates are decided" description="Guidance, not a guarantee. Always check the package and the food itself.">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>The freshness stages</CardTitle></CardHeader>
          <CardContent className="gap-2 px-4">
            {STAGES.map((s) => (
              <View key={s} className="flex-row items-start gap-3">
                <Icon as={STAGE_STYLE[s].icon} size={16} className={`mt-0.5 ${STAGE_STYLE[s].text}`} />
                <Text className="flex-1 text-sm"><Text className="font-semibold">{STAGE_META[s].label}.</Text> {STAGE_MEANING[s]}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>Rules the app always keeps</CardTitle></CardHeader>
          <CardContent className="gap-3 px-4">
            {rules.map((r) => (
              <View key={r.title} className="flex-row items-start gap-3">
                <Icon as={ShieldCheck} size={16} className="text-stage-fresh mt-0.5" />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold">{r.title}</Text>
                  <Text className="text-muted-foreground text-sm">{r.body}</Text>
                </View>
              </View>
            ))}
          </CardContent>
        </Card>
        <Text className="text-muted-foreground text-xs">A date that has passed doesn't make food safe or unsafe on its own. When in doubt, throw it out.</Text>
        <Button variant="outline" className="h-11 self-start" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}><Text>Back</Text></Button>
      </Screen>
    </View>
  );
}
