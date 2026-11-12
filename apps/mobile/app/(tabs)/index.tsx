import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { ResponsiveSheet } from '@/components/common/responsive-sheet';
import { Screen } from '@/components/common/screen';
import { AttentionCard } from '@/components/fridge/attention-card';
import { FridgeCabinet } from '@/components/fridge/fridge-cabinet';
import { HauntPanel } from '@/components/fridge/haunt-panel';
import { ItemDetails } from '@/components/fridge/item-details';
import { TonightCard } from '@/components/fridge/tonight-card';
import { WeekCard } from '@/components/ledger/week-card';
import { StageKey } from '@/components/fridge/stage-key';
import { StageFilter, type StageFilterValue } from '@/components/fridge/stage-filter';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/currency/money';
import { useSummarize } from '@/lib/rates';
import { isAtRisk, isHaunting, stageOf } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { useActiveItems, useLayout, useStageCounts } from '@/lib/hooks';
import { useApp } from '@/lib/store/app-store';
import { toast } from '@/lib/store/toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus, Refrigerator, ScanLine, Search } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

const FILTERS = new Set<StageFilterValue>(['all', 'haunting', 'fresh', 'aging', 'expiring', 'rotting', 'spoiled']);

export default function FridgeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ stage?: string; q?: string; item?: string }>();
  const { isPhone, hasSidePanel } = useLayout();
  const items = useActiveItems();
  const counts = useStageCounts(items);
  const summarize = useSummarize();
  const discardItem = useApp((s) => s.discardItem);
  const loadSampleData = useApp((s) => s.loadSampleData);
  const [buryOpen, setBuryOpen] = React.useState(false);

  const filter = (FILTERS.has(params.stage as StageFilterValue) ? params.stage : 'all') as StageFilterValue;
  const q = params.q ?? '';
  const selected = items.find((i) => i.id === params.item) ?? null;
  const setParams = (p: Record<string, string | undefined>) => router.setParams(p);

  const visible = items.filter((i) => matches(i, filter, q));
  const spoiled = items.filter((i) => stageOf(i) === 'spoiled');
  // Most urgent first, so "Check first" opens the one that matters most.
  const estimated = items.filter((i) => !i.expiryConfirmed && stageOf(i) !== 'spoiled').sort((a, b) => a.expires.localeCompare(b.expires));
  const atRisk = summarize(items.filter((i) => isAtRisk(stageOf(i))).map((i) => ({ minor: Math.round(i.priceMinor * i.fraction), currency: i.currency })));
  const select = (id: string) => setParams({ item: params.item === id && hasSidePanel ? undefined : id });
  const closeItem = () => setParams({ item: undefined });

  const buryAll = () => {
    const lost = spoiled.map((i) => discardItem(i.id)).filter((x) => x !== null);
    const text = lost.length === 1 ? formatMoney(lost[0]!.value, lost[0]!.currency) : summarize(lost.map((l) => ({ minor: l!.value, currency: l!.currency }))).text;
    toast(`${lost.length} buried · ${text} lost`);
    closeItem();
  };

  const body = (
    <Screen
      title="Your fridge"
      description={`${items.length} items · ${counts.expiring} expiring soon · ${atRisk.text} at risk`}
      fabClearance={isPhone}
      actions={
        <Button variant="outline" className="h-11" onPress={() => router.push({ pathname: '/review', params: { manual: '1' } })}>
          <Icon as={Plus} size={16} />
          <Text>Add item</Text>
        </Button>
      }>
      <View className="relative">
        <View className="absolute bottom-0 left-3 top-0 z-10 justify-center" pointerEvents="none">
          <Icon as={Search} size={16} className="text-muted-foreground" />
        </View>
        <Input
          value={q}
          onChangeText={(t) => setParams({ q: t || undefined })}
          placeholder="Search the fridge…"
          accessibilityLabel="Search the fridge"
          className="h-11 pl-9"
          autoCorrect={false}
        />
      </View>
      <StageFilter value={filter} onChange={(v) => setParams({ stage: v === 'all' ? undefined : v })} counts={counts} total={items.length} />
      <StageKey />

      <AttentionCard
        spoiled={spoiled}
        estimated={estimated}
        onBury={() => setBuryOpen(true)}
        onCheck={() => select(estimated[0].id)}
      />

      <TonightCard items={items} />
      <WeekCard digest />

      {items.length === 0 ? (
        <EmptyState
          icon={Refrigerator}
          title="Your fridge is empty"
          description="Photograph a grocery receipt or single items, or add them by hand, and they'll appear on these shelves. Want to look around first? Load some sample food."
          action={
            <View className="flex-row flex-wrap justify-center gap-2">
              <Button className="h-11" onPress={() => router.navigate('/scan')}><Text>Add by photo</Text></Button>
              <Button variant="outline" className="h-11" onPress={() => router.push({ pathname: '/review', params: { manual: '1' } })}><Text>Add by hand</Text></Button>
              <Button variant="ghost" className="h-11" onPress={() => { loadSampleData(); toast('Sample data added. Delete it any time in Settings.'); }}><Text>Try with sample data</Text></Button>
            </View>
          }
        />
      ) : (
        <FridgeCabinet items={visible} selectedId={selected?.id ?? null} onSelect={select} filtered={filter !== 'all' || q !== ''} />
      )}
    </Screen>
  );

  return (
    <View className="flex-1 flex-row">
      <View className="flex-1">
        {body}
        {isPhone && (
          <Button
            onPress={() => router.navigate('/scan')}
            className="absolute bottom-4 right-4 h-14 rounded-xl px-5"
            accessibilityLabel="Add by photo">
            <Icon as={ScanLine} size={18} className="text-primary-foreground" />
            <Text className="font-semibold">Add by photo</Text>
          </Button>
        )}
      </View>

      {hasSidePanel && (
        <View role="complementary" aria-label="Details" className="border-border bg-card w-80 border-l">
          {selected ? (
            <ScrollView contentContainerClassName="gap-2 p-4">
              <Button variant="ghost" className="h-11 self-start" onPress={closeItem} accessibilityLabel="Close">
                <Icon as={ArrowLeft} size={16} />
                <Text>Back to haunting list</Text>
              </Button>
              <ItemDetails item={selected} onDone={closeItem} />
            </ScrollView>
          ) : (
            <HauntPanel items={items} onSelect={select} />
          )}
        </View>
      )}

      {!hasSidePanel && (
        <ResponsiveSheet open={!!selected} onClose={closeItem} title={selected?.name ?? 'Item'}>
          {selected && <ItemDetails item={selected} onDone={closeItem} />}
        </ResponsiveSheet>
      )}

      <ConfirmDialog
        open={buryOpen}
        onOpenChange={setBuryOpen}
        title={`Bury ${spoiled.length} spoiled item${spoiled.length === 1 ? '' : 's'}?`}
        description={`${spoiled.map((i) => i.name).join(', ')} will move to the graveyard and count as wasted.`}
        confirmLabel="Bury them"
        cancelLabel="Keep for now"
        destructive
        onConfirm={buryAll}
      />
    </View>
  );
}

function matches(i: Item, filter: StageFilterValue, q: string) {
  const s = stageOf(i);
  if (filter === 'haunting' && !isHaunting(s)) return false;
  if (filter !== 'all' && filter !== 'haunting' && s !== filter) return false;
  return !q || i.name.toLowerCase().includes(q.trim().toLowerCase());
}
