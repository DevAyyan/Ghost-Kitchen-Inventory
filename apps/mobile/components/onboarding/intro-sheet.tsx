import { ResponsiveSheet } from '@/components/common/responsive-sheet';
import { STAGE_MEANING } from '@/components/fridge/stage-key';
import { Art } from '@/components/halloween/art';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Stage } from '@/lib/domain/types';
import { notificationsSupported, requestNotificationPermission } from '@/lib/notifications';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { toast } from '@/lib/store/toast';
import { useRouter } from 'expo-router';
import { Bell, ReceiptText, Sparkles } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

const STAGES: Stage[] = ['fresh', 'aging', 'expiring', 'rotting', 'spoiled'];
const STEPS = ['Welcome to Ghost Kitchen', 'How fresh is it?', 'Fill your fridge'] as const;

/**
 * First run only: what the app is for, what the stage colours and ghosts mean, and how to get food in.
 * Skippable at every step; closing it in any way counts as seen, so it never comes back.
 */
export function IntroSheet() {
  const seen = useSettings((s) => s.settings.introSeen);
  const reminders = useSettings((s) => s.settings.notifyDigest);
  const update = useSettings((s) => s.update);
  const hasFood = useApp((s) => s.items.some((i) => i.status === 'active'));
  const loadSampleData = useApp((s) => s.loadSampleData);
  const router = useRouter();
  const [step, setStep] = React.useState(0);

  const finish = () => update({ introSeen: true });
  const last = step === STEPS.length - 1;

  const turnOnReminders = async () => {
    const res = await requestNotificationPermission();
    if (res === 'granted') { update({ notifyDigest: true }); toast('Daily reminder on. Change the time in Settings.'); }
    else if (res === 'denied') toast('Notifications are blocked for Ghost Kitchen. You can allow them in your phone settings.');
  };

  return (
    <ResponsiveSheet
      open={!seen}
      onClose={finish}
      title={STEPS[step]}
      description={`Step ${step + 1} of ${STEPS.length}`}
      footer={
        <>
          {step > 0 ? (
            <Button variant="outline" className="h-11" onPress={() => setStep(step - 1)}><Text>Back</Text></Button>
          ) : (
            <Button variant="ghost" className="h-11" onPress={finish}><Text>Skip</Text></Button>
          )}
          {/* Pixel step pips; the sheet's description says "Step 2 of 3" for screen readers. */}
          <View aria-hidden className="flex-1 flex-row items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <View key={i} className={i <= step ? 'bg-primary h-2.5 w-2.5' : 'border-muted-foreground h-2.5 w-2.5 border-2'} />
            ))}
          </View>
          <Button className="h-11" onPress={() => (last ? finish() : setStep(step + 1))}>
            <Text>{last ? 'Done' : 'Next'}</Text>
          </Button>
        </>
      }>
      {step === 0 && (
        <View className="items-center gap-3 py-2">
          <Art name="ghost" size={64} />
          <Text className="text-center">Ghost Kitchen keeps track of what's in your fridge, freezer and pantry, and tells you what to cook before it turns.</Text>
          <Text className="text-muted-foreground text-center text-sm">Food you throw away gets a tombstone in the graveyard, with what it cost you.</Text>
        </View>
      )}
      {step === 1 && (
        <View className="gap-3">
          {STAGES.map((s) => (
            <View key={s} className="flex-row items-start gap-3">
              <View className={`${STAGE_STYLE[s].bg} h-7 w-7 items-center justify-center border-2 border-black/40`}>
                <Icon as={STAGE_STYLE[s].icon} size={14} className="text-background" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold">{STAGE_STYLE[s].label}</Text>
                <Text className="text-muted-foreground text-sm">{STAGE_MEANING[s]}</Text>
              </View>
            </View>
          ))}
          <Text className="text-muted-foreground text-sm">Glowing, mouldy and haunted tiles show the same stages. Dates are guidance, not a guarantee: always check the package and the food itself.</Text>
        </View>
      )}
      {step === 2 && (
        <View className="gap-3">
          <Button className="h-11" onPress={() => { finish(); router.navigate('/scan'); }}>
            <Icon as={ReceiptText} size={16} className="text-primary-foreground" />
            <Text>Scan a receipt</Text>
          </Button>
          {!hasFood && (
            <Button variant="outline" className="h-11" onPress={() => { loadSampleData(); finish(); toast('Sample data added. Delete it any time in Settings.'); }}>
              <Icon as={Sparkles} size={16} />
              <Text>Try with sample data</Text>
            </Button>
          )}
          {notificationsSupported ? (
            !reminders && (
              <Button variant="outline" className="h-11" onPress={() => void turnOnReminders()}>
                <Icon as={Bell} size={16} />
                <Text>Remind me what to cook</Text>
              </Button>
            )
          ) : (
            <Text className="text-muted-foreground text-sm">Daily "cook this tonight" reminders come with the Android app.</Text>
          )}
        </View>
      )}
    </ResponsiveSheet>
  );
}
