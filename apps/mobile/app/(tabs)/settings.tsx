import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Screen } from '@/components/common/screen';
import { CurrencyChip } from '@/components/currency/currency-chip';
import { CurrencyPicker } from '@/components/currency/currency-picker';
import { FilterChip } from '@/components/common/filter-chip';
import { DietFilter } from '@/components/recipes/diet-filter';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { apiBase } from '@/lib/api';
import { HouseholdSection } from '@/components/settings/household-section';
import { Section, StatusLine } from '@/components/settings/parts';
import { useHousehold } from '@/lib/store/household-store';
import { leaveHousehold } from '@/lib/sync';
import { notificationsSupported, requestNotificationPermission } from '@/lib/notifications';
import { deviceLocaleTag } from '@/lib/locale';
import { clearProductCache } from '@/lib/products';
import { useApp } from '@/lib/store/app-store';
import { type Settings, useSettings } from '@/lib/store/settings-store';
import { useServer } from '@/lib/store/server-store';
import { toast } from '@/lib/store/toast';
import Constants from 'expo-constants';
import { TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type PickerTarget = 'defaultCurrency' | 'displayCurrency' | null;
type Confirm = 'sample' | 'clear' | null;

export default function SettingsScreen() {
  const s = useSettings((st) => st.settings);
  const update = useSettings((st) => st.update);
  const loadSampleData = useApp((st) => st.loadSampleData);
  const clearAllData = useApp((st) => st.clearAllData);
  const itemCount = useApp((st) => st.items.filter((i) => i.status === 'active').length);
  const [picker, setPicker] = React.useState<PickerTarget>(null);
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const household = useHousehold((st) => st.household);

  return (
    <Screen title="Settings">
      <ServerSection />
      <HouseholdSection />

      <Section title="Currency">
        <Text className="text-muted-foreground mb-2 text-sm">
          Every item keeps the currency it was bought in, so changing these never rewrites prices you already have.
        </Text>
        <Row title="Default currency" sub={`For new items: receipts with no clear currency, and items you add by hand. Set from your device (${deviceLocaleTag()}).`}>
          <CurrencyChip code={s.defaultCurrency} showName={false} onPress={() => setPicker('defaultCurrency')} prefix="Default" />
        </Row>
        <Separator />
        <Row title="Display currency" sub="Totals (ledger, money at risk, recipe savings) are converted to this with daily rates from your Ghost Kitchen server. While it's offline, totals stay in their original currency.">
          <CurrencyChip code={s.displayCurrency} showName={false} onPress={() => setPicker('displayCurrency')} prefix="Display" />
        </Row>
      </Section>

      <Section title="Diet">
        <Text className="text-muted-foreground mb-2 text-sm">Recipes only use ingredients that fit every diet you pick. Ingredients are checked by Gemini; anything that can't be checked is left out.</Text>
        <DietFilter value={s.diets} onChange={(diets) => update({ diets })} />
      </Section>

      <ReminderSection />

      <Section title="AI & privacy">
        <ToggleRow
          k="tesseractOnly"
          invert
          title="Use AI (Google Gemini)"
          sub="Identifies receipt items, estimates shelf life and checks diets. When off, receipts are read with basic rules and dates are rough estimates."
        />
        <Text className="text-muted-foreground mt-2 text-xs">
          Your server sends receipt text and product names to Google Gemini, never your account details. Photos of single items are the one exception: you choose to send those, and they go to Gemini as images. On Gemini's free tier, Google may use submitted content to improve its products. Recipes come from TheMealDB.
        </Text>
      </Section>

      <Section title="Sound and motion">
        <ToggleRow k="soundEffects" title="Sounds and vibration" sub="A short sound and a light tap when you open or close the freezer, fridge or pantry doors." />
        <ToggleRow k="reduceMotion" title="Reduce motion" sub="Stills the glow, flies, ghosts, flickering fridge light, door swings and graveyard fog. Your system setting is also respected." />
      </Section>

      <Section title="Data">
        <Text className="text-muted-foreground mb-2 text-sm">
          {household ? `Your fridge is stored on this device and shared with ${household.name}.` : 'Your fridge is stored on this device.'} {itemCount} item{itemCount === 1 ? '' : 's'} right now.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Button variant="outline" className="h-11" onPress={() => setConfirm('sample')}><Text>Load sample data</Text></Button>
          <Button variant="outline" className="h-11" onPress={() => { clearProductCache(); toast('Saved shelf-life lookups cleared'); }}><Text>Clear saved lookups</Text></Button>
          <Button variant="destructive" className="h-11" onPress={() => setConfirm('clear')}><Text className="text-white">Delete all data</Text></Button>
        </View>
      </Section>

      <Text className="text-muted-foreground pb-4 text-center text-xs">Ghost Kitchen {Constants.expoConfig?.version ?? ''}</Text>

      <CurrencyPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'defaultCurrency' ? 'Default currency' : 'Display currency'}
        note={picker === 'defaultCurrency' ? 'Used when a receipt has no clear currency and for manual items.' : 'Ledger and savings are shown in this currency.'}
        value={picker ? s[picker] : s.defaultCurrency}
        onSelect={(code) => picker && update({ [picker]: code })}
      />
      <ConfirmDialog
        open={confirm === 'sample'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Load sample data?"
        description={`Adds about 20 example items, a receipt and some history so you can try the app. Your own items stay. You can delete everything later.${household ? ` Everyone in ${household.name} will see them too.` : ''}`}
        confirmLabel="Load samples"
        onConfirm={() => { loadSampleData(); toast('Sample data added'); }}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete all data?"
        description={household
          ? `This device leaves ${household.name} first, so nothing is deleted for the others. Then every item, receipt, photo and history entry on this device is deleted. Settings are kept. This can't be undone.`
          : "Deletes every item, receipt, photo and history entry on this device. Settings are kept. This can't be undone."}
        confirmLabel="Delete everything"
        destructive
        onConfirm={() => {
          // Leave before clearing, or the deletions would sync to everyone.
          void (async () => {
            if (useHousehold.getState().household) await leaveHousehold();
            clearAllData();
            toast('All data deleted');
          })();
        }}
      />
    </Screen>
  );
}

function ServerSection() {
  const s = useSettings((st) => st.settings);
  const update = useSettings((st) => st.update);
  const { status, reachable, lastError, check } = useServer();
  const [url, setUrl] = React.useState(s.apiUrl);
  const [token, setToken] = React.useState(s.apiToken);
  const [testing, setTesting] = React.useState(false);
  // Typed but not saved: shown so an edit isn't silently lost when leaving the screen.
  const dirty = url.trim().replace(/\/+$/, '') !== s.apiUrl || token.trim() !== s.apiToken;

  const save = async () => {
    const clean = url.trim().replace(/\/+$/, '');
    if (clean && !/^https?:\/\/[^\s/]+/i.test(clean)) { toast('Enter a full address, like https://kitchen.example.com'); return; }
    update({ apiUrl: clean, apiToken: token.trim() });
    setTesting(true);
    const st = await check();
    setTesting(false);
    toast(st ? 'Connected to your server' : "Couldn't connect. Check the address.");
  };

  return (
    <Section title="Server">
      <Text className="text-muted-foreground mb-3 text-sm">
        Receipt reading, shelf-life lookups, recipes and exchange rates run on your Ghost Kitchen server. Your fridge itself works offline.
      </Text>
      <View className="gap-1.5">
        <Label nativeID="api-url">Server address</Label>
        <Input
          aria-labelledby="api-url"
          value={url}
          onChangeText={setUrl}
          placeholder={apiBase() || 'https://kitchen.example.com'}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          className="h-11"
        />
      </View>
      <View className="mt-3 gap-1.5">
        <Label nativeID="api-token">Access token (if your server has one)</Label>
        <Input aria-labelledby="api-token" value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false} className="h-11" />
      </View>
      <View className="mt-3 flex-row flex-wrap items-center gap-3">
        <Button className="h-11" onPress={() => void save()} disabled={testing}>
          <Text>{testing ? 'Checking…' : 'Save and test connection'}</Text>
        </Button>
        {dirty && !testing && (
          <View className="flex-row items-center gap-1.5" aria-live="polite">
            <Icon as={TriangleAlert} size={14} className="text-warning" />
            <Text className="text-muted-foreground text-sm">Not saved yet</Text>
          </View>
        )}
      </View>

      {(reachable !== null || testing) && (
        <View className="border-border mt-3 gap-1.5 rounded-md border p-3" aria-live="polite">
          {testing ? (
            <StatusLine state="pending" text="Checking the server…" />
          ) : reachable && status ? (
            <>
              <StatusLine state="ok" text={`Connected to ${apiBase()}`} />
              <StatusLine state={status.db ? 'ok' : 'bad'} text={status.db ? 'Database working' : 'Database unavailable'} />
              <StatusLine state={status.ocr ? 'ok' : 'bad'} text={status.ocr ? 'Receipt text recognition working' : 'Receipt text recognition unavailable'} />
              <StatusLine
                state={status.ai.enabled ? 'ok' : 'warn'}
                text={status.ai.enabled ? `AI: ${status.ai.model}, ${status.ai.usedToday} of ${status.ai.limitPerDay} requests used today` : 'AI not configured on the server: basic receipt reading only'}
              />
              {status.recipes.keyType === 'test' && (
                <StatusLine state="warn" text="Recipes use TheMealDB's free test key: fine for personal use, not for an app-store release." />
              )}
            </>
          ) : (
            <StatusLine state="bad" text={lastError ?? "Can't reach the server."} />
          )}
        </View>
      )}
    </Section>
  );
}

const HOURS = [8, 12, 17, 19];
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'am' : 'pm'}`;

function ReminderSection() {
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

type BoolSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

/** `invert`: the switch shows the opposite of the stored flag (e.g. "Use AI" over `tesseractOnly`). */
function ToggleRow({ k, title, sub, invert }: { k: BoolSetting; title: string; sub?: string; invert?: boolean }) {
  const stored = useSettings((st) => st.settings[k]);
  const update = useSettings((st) => st.update);
  const checked = invert ? !stored : stored;
  const toggle = () => update({ [k]: !stored });
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={title}
      className="min-h-12 flex-row items-center gap-3 py-2">
      <View className="flex-1 gap-0.5">
        <Text className="font-medium">{title}</Text>
        {sub ? <Text className="text-muted-foreground text-sm">{sub}</Text> : null}
      </View>
      {/* Visual only: the whole row is the switch, so this one is hidden from assistive tech and the tab order. */}
      <Switch checked={checked} onCheckedChange={toggle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden tabIndex={-1} focusable={false} />
    </Pressable>
  );
}

function Row({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-center gap-3 py-2">
      <View className="min-w-48 flex-1 gap-0.5">
        <Text className="font-medium">{title}</Text>
        <Text className="text-muted-foreground text-sm">{sub}</Text>
      </View>
      {children}
    </View>
  );
}
