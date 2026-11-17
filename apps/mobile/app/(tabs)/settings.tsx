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
import { Row, Section, StatusLine, ToggleRow } from '@/components/settings/parts';
import { ReminderSection } from '@/components/settings/reminder-section';
import { ServerSection } from '@/components/settings/server-section';
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
