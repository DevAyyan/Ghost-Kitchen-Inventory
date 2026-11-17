import { FilterChip } from '@/components/common/filter-chip';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { notificationsSupported, requestNotificationPermission } from '@/lib/notifications';
import { useSettings } from '@/lib/store/settings-store';
import { toast } from '@/lib/store/toast';
import { Pressable, View } from 'react-native';
import { Section } from './parts';

const HOURS = [8, 12, 17, 19];

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'am' : 'pm'}`;

export function ReminderSection() {
  const on = useSettings((st) => st.settings.notifyDigest);
  const hour = useSettings((st) => st.settings.notifyHour);
  const update = useSettings((st) => st.update);

  const toggle = async () => {
    if (on) { update({ notifyDigest: false }); return; }
    const res = await requestNotificationPermission();
    if (res === 'granted') { update({ notifyDigest: true }); toast(`Reminder set for ${hourLabel(hour)}`); }
    else toast(res === 'denied' ? 'Notifications are blocked. Allow them for Ghost Kitchen in your phone settings.' : 'Reminders need the Android app.');
  };

  return (
    <Section title="Reminders">
      {notificationsSupported ? (
        <>
          <WeeklyToggle />
          <Pressable
            onPress={() => void toggle()}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            aria-checked={on}
            accessibilityLabel="Daily cook-tonight reminder"
            className="min-h-12 flex-row items-center gap-3 py-2">
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">Daily "cook tonight" reminder</Text>
              <Text className="text-muted-foreground text-sm">One message a day naming what is about to turn. Nothing on days when nothing is at risk. Works offline.</Text>
            </View>
            <Switch checked={on} onCheckedChange={() => void toggle()} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden tabIndex={-1} focusable={false} />
          </Pressable>
          {on && (
            <View role="group" aria-label="Reminder time" className="mt-2 flex-row flex-wrap gap-2">
              {HOURS.map((h) => (
                <FilterChip key={h} pressed={hour === h} onPress={() => update({ notifyHour: h })}>
                  <Text className="text-sm">{hourLabel(h)}</Text>
                </FilterChip>
              ))}
            </View>
          )}
        </>
      ) : (
        <Text className="text-muted-foreground text-sm">Daily reminders and the Monday summary are sent by the Android app. On the web, the fridge shows last week's summary every Monday, and the ledger shows this week so far.</Text>
      )}
    </Section>
  );
}

function WeeklyToggle() {
  const on = useSettings((st) => st.settings.notifyWeekly);
  const update = useSettings((st) => st.update);
  const toggle = async () => {
    if (on) { update({ notifyWeekly: false }); return; }
    const res = await requestNotificationPermission();
    if (res === 'granted') { update({ notifyWeekly: true }); toast('Weekly summary on. It arrives on Mondays.'); }
    else toast(res === 'denied' ? 'Notifications are blocked. Allow them for Ghost Kitchen in your phone settings.' : 'The weekly summary needs the Android app.');
  };
  return (
    <Pressable
      onPress={() => void toggle()}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      accessibilityLabel="Monday summary of your week"
      className="min-h-12 flex-row items-center gap-3 py-2">
      <View className="flex-1 gap-0.5">
        <Text className="font-medium">Monday summary</Text>
        <Text className="text-muted-foreground text-sm">What you rescued and threw out last week, in money, and what to watch. Only sent if something happened.</Text>
      </View>
      <Switch checked={on} onCheckedChange={() => void toggle()} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden tabIndex={-1} focusable={false} />
    </Pressable>
  );
}
