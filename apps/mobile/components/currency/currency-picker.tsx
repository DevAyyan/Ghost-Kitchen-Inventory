import { ResponsiveSheet } from '@/components/common/responsive-sheet';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { CURRENCIES, type CurrencyInfo } from '@/lib/currency/catalog';
import { useApp } from '@/lib/store/app-store';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, SectionList, View } from 'react-native';

interface CurrencyPickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  note: string;
  value: string;
  /** Candidates for an ambiguous symbol, shown first ("Likely for this receipt"). */
  likely?: string[];
  onSelect: (code: string) => void;
}

/** Searchable currency list: likely → recent → all. Bottom sheet on phones, side sheet otherwise. */
export function CurrencyPicker({ open, onClose, title, note, value, likely = [], onSelect }: CurrencyPickerProps) {
  const recent = useApp((s) => s.recentCurrencies);
  const remember = useApp((s) => s.rememberCurrency);
  const [q, setQ] = React.useState('');

  React.useEffect(() => { if (open) setQ(''); }, [open]);

  const sections = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    const hit = (c: CurrencyInfo) =>
      !qq || c.code.toLowerCase().includes(qq) || c.name.toLowerCase().includes(qq) || c.symbol.toLowerCase() === qq;
    const pick = (codes: string[]) => CURRENCIES.filter((c) => codes.includes(c.code) && hit(c));
    const likelyList = pick(likely);
    const recentList = pick(recent.filter((c) => !likely.includes(c)));
    const used = new Set([...likelyList, ...recentList].map((c) => c.code));
    const rest = CURRENCIES.filter((c) => !used.has(c.code) && hit(c));
    return [
      { title: 'Likely for this receipt', data: likelyList },
      { title: 'Recent', data: recentList },
      { title: 'All currencies', data: rest },
    ].filter((s) => s.data.length);
  }, [q, likely, recent]);

  const choose = (code: string) => {
    remember(code);
    onSelect(code);
    onClose();
  };

  return (
    <ResponsiveSheet open={open} onClose={onClose} title={title} description={note} scroll={false}>
      <View className="flex-1 gap-2 px-4">
        <Input
          value={q}
          onChangeText={setQ}
          placeholder="Search by code, name or symbol…"
          accessibilityLabel="Search currencies"
          autoCorrect={false}
          autoCapitalize="none"
          className="h-11"
        />
        <SectionList
          className="min-h-72"
          sections={sections}
          keyExtractor={(c) => c.code}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={<Text className="text-muted-foreground p-3 text-sm">No currency matches.</Text>}
          renderSectionHeader={({ section }) => (
            <Text className="text-muted-foreground px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider">{section.title}</Text>
          )}
          renderItem={({ item: c }) => {
            const selected = c.code === value;
            return (
              <Pressable
                onPress={() => choose(c.code)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${c.name}, ${c.code}`}
                className={cn('web:hover:bg-accent active:bg-accent min-h-11 flex-row items-center gap-3 rounded-md px-2', selected && 'bg-accent')}>
                <Text className="text-primary w-10 text-center font-semibold">{c.symbol}</Text>
                <Text className="w-12 font-semibold">{c.code}</Text>
                <Text className="text-muted-foreground flex-1 text-sm" numberOfLines={1}>{c.name}</Text>
                {selected && <Icon as={Check} size={16} className="text-primary" />}
              </Pressable>
            );
          }}
        />
      </View>
    </ResponsiveSheet>
  );
}
