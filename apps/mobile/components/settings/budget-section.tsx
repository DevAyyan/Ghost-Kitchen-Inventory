import { Section } from '@/components/settings/parts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { currencyInfo } from '@/lib/currency/catalog';
import { toMajor, toMinor } from '@/lib/currency/money';
import { parsePrice } from '@/lib/domain/draft';
import { useSettings } from '@/lib/store/settings-store';
import { toast } from '@/lib/store/toast';
import * as React from 'react';
import { View } from 'react-native';

/** Optional monthly grocery budget. Kept in the currency it was typed in; the ledger converts it for display. */
export function BudgetSection() {
  const { monthlyBudgetMinor, monthlyBudgetCurrency, displayCurrency } = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [text, setText] = React.useState(monthlyBudgetMinor > 0 ? String(toMajor(monthlyBudgetMinor, monthlyBudgetCurrency)) : '');
  const shown = monthlyBudgetMinor > 0 ? monthlyBudgetCurrency : displayCurrency;

  const save = () => {
    const n = parsePrice(text);
    if (!Number.isFinite(n) || n < 0) return toast('Enter the budget as a number, like 400.');
    update({ monthlyBudgetMinor: n === 0 ? 0 : toMinor(n, displayCurrency), monthlyBudgetCurrency: displayCurrency });
    toast(n === 0 ? 'Budget turned off' : 'Budget saved');
  };

  return (
    <Section title="Monthly budget">
      <Text className="text-muted-foreground mb-2 text-sm">Optional. The ledger shows what you've spent on groceries this calendar month against it. Leave empty or enter 0 for no budget.</Text>
      <View className="flex-row items-center gap-2">
        <Text className="text-primary w-10 text-right font-semibold">{currencyInfo(shown).symbol}</Text>
        <Input
          value={text}
          onChangeText={(t) => setText(t.replace(/[^0-9.,]/g, ''))}
          onSubmitEditing={save}
          keyboardType="decimal-pad"
          placeholder="No budget"
          accessibilityLabel={`Monthly grocery budget in ${displayCurrency}`}
          className="h-11 w-36"
        />
        <Button variant="outline" className="h-11" onPress={save}><Text>Save</Text></Button>
      </View>
      {monthlyBudgetMinor > 0 && monthlyBudgetCurrency !== displayCurrency ? (
        <Text className="text-muted-foreground mt-2 text-xs">This budget is in {monthlyBudgetCurrency}. Saving again sets it in {displayCurrency}.</Text>
      ) : null}
    </Section>
  );
}
