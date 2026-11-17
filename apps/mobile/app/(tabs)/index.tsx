import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { FilterChip } from '@/components/common/filter-chip';
import { ResponsiveSheet } from '@/components/common/responsive-sheet';
import { Screen } from '@/components/common/screen';
import { AttentionCard } from '@/components/fridge/attention-card';
import { FridgeCabinet } from '@/components/fridge/fridge-cabinet';
import { HauntPanel } from '@/components/fridge/haunt-panel';
import { ItemDetails } from '@/components/fridge/item-details';
import { QuickSheet } from '@/components/fridge/quick-sheet';
import { StageKeyPanel, StageKeyToggle } from '@/components/fridge/stage-key';
import { StageFilter, type StageFilterValue } from '@/components/fridge/stage-filter';
import { TonightCard } from '@/components/fridge/tonight-card';
import { UseFirstList } from '@/components/fridge/use-first-list';
import { useFridgeActions } from '@/components/fridge/use-fridge-actions';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { isHaunting, stageOf } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { useActiveItems, useLayout, useStageCounts } from '@/lib/hooks';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { toast } from '@/lib/store/toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, List, Plus, Refrigerator, Search } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

const FILTERS = new Set<StageFilterValue>(['all', 'haunting', 'fresh', 'aging', 'expiring', 'rotting', 'spoiled']);

export default function FridgeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ stage?: string; q?: string; item?: string }>();
  const { isPhone, hasSidePanel, width } = useLayout();
  const items = useActiveItems();
  const counts = useStageCounts(items);
  const loadSampleData = useApp((s) => s.loadSampleData);
  const view = useSettings((s) => s.settings.fridgeView);
  const updateSettings = useSettings((s) => s.update);
  const act = useFridgeActions(items);
  const [buryOpen, setBuryOpen] = React.useState(false);
  const [keyOpen, setKeyOpen] = React.useState(false);
  const [quickId, setQuickId] = React.useState<string | null>(null);
  // Matches FridgeCabinet: from here the pantry stands beside the fridge, with room for Tonight under it.
  const sideBySide = width >= 1024;

  const filter = (FILTERS.has(params.stage as StageFilterValue) ? params.stage : 'all') as StageFilterValue;
  const q = params.q ?? '';
  const selected = items.find((i) => i.id === params.item) ?? null;
  const quick = items.find((i) => i.id === quickId) ?? null;
  const setParams = (p: Record<string, string | undefined>) => router.setParams(p);
  const visible = items.filter((i) => matches(i, filter, q));
  const select = (id: string) => setParams({ item: params.item === id && hasSidePanel ? undefined : id });
  const closeItem = () => setParams({ item: undefined });
  const kitchen = view !== 'list';

  // One line that says what matters: how much needs eating soon, and what it's worth.
  const hero = items.length === 0
    ? 'Nothing stored yet'
    : act.turning.length === 0
      ? `${items.length} items · nothing urgent`
      : `${act.turning.length} to use soon · ${act.atRisk.text} at risk`;

  const body = (
    <Screen
      title="Your fridge"
      description={hero}
      actions={
        // Adding food is one place: the Scan screen (photo, receipt, or by hand).
        <Button
          variant="outline"
          className={isPhone ? 'h-11 w-11 px-0' : 'h-11'}
          accessibilityLabel="Add food"
          onPress={() => router.navigate('/scan')}>
          <Icon as={Plus} size={16} />
          {!isPhone && <Text>Add food</Text>}
        </Button>
      }>
      <View className="flex-row items-center gap-2">
        <View className="relative min-w-0 flex-1">
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
        <View role="radiogroup" aria-label="Show the fridge as" className="flex-row gap-1">
          <FilterChip pressed={kitchen} onPress={() => updateSettings({ fridgeView: 'kitchen' })} accessibilityLabel="Kitchen view">
            <Icon as={Refrigerator} size={16} className={kitchen ? 'text-primary' : 'text-muted-foreground'} />
          </FilterChip>
          <FilterChip pressed={!kitchen} onPress={() => updateSettings({ fridgeView: 'list' })} accessibilityLabel="Use-first list">
            <Icon as={List} size={16} className={!kitchen ? 'text-primary' : 'text-muted-foreground'} />
          </FilterChip>
        </View>
      </View>
      <StageFilter
        value={filter}
        onChange={(v) => setParams({ stage: v === 'all' ? undefined : v })}
        counts={counts}
        total={items.length}
        trailing={<StageKeyToggle open={keyOpen} onToggle={() => setKeyOpen((o) => !o)} />}
      />
      {keyOpen && <StageKeyPanel />}

      {/* Only the most urgent decision shows; the rest fold away, so the food stays near the top. */}
      <AttentionCard
        spoiled={act.spoiled}
        estimated={act.estimated}
        moves={act.moves}
        forgotten={act.forgotten}
        onBury={() => setBuryOpen(true)}
        onOpen={select}
        onMove={act.moveNow}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Refrigerator}
          title="Your fridge is empty"
          description="Snap a receipt or a single item, or add food by hand, and it appears on these shelves."
          action={
            <View className="flex-row flex-wrap justify-center gap-2">
              <Button className="h-11" onPress={() => router.navigate('/scan')}><Text>Add food</Text></Button>
              <Button variant="ghost" className="h-11" onPress={() => { loadSampleData(); toast('Sample data added. Delete it any time in Settings.'); }}><Text>Try with sample data</Text></Button>
            </View>
          }
        />
      ) : kitchen ? (
        <FridgeCabinet
          items={visible}
          allItems={items}
          selectedId={selected?.id ?? null}
          onSelect={select}
          onQuick={setQuickId}
          filtered={filter !== 'all' || q !== ''}
          filterKey={`${filter}|${q}`}
          belowPantry={sideBySide ? <TonightCard items={items} /> : undefined}
        />
      ) : (
        <UseFirstList items={visible} onOpen={select} onUsed={act.usedAll} onBinned={act.binned} />
      )}

      {!(sideBySide && kitchen && items.length > 0) && <TonightCard items={items} />}
    </Screen>
  );

  return (
    <View className="flex-1 flex-row">
      <View className="flex-1">{body}</View>

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
          {selected && <ItemDetails item={selected} onDone={closeItem} showName={false} />}
        </ResponsiveSheet>
      )}
      <QuickSheet item={quick} onClose={() => setQuickId(null)} onUsed={act.usedAll} onBinned={act.binned} onDetails={select} />

      <ConfirmDialog
        open={buryOpen}
        onOpenChange={setBuryOpen}
        title={`Bury ${act.spoiled.length} spoiled item${act.spoiled.length === 1 ? '' : 's'}?`}
        description={`${act.spoiled.map((i) => i.name).join(', ')} will move to the graveyard and count as wasted.`}
        confirmLabel="Bury them"
        cancelLabel="Keep for now"
        destructive
        onConfirm={() => { act.buryAll(); closeItem(); }}
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
