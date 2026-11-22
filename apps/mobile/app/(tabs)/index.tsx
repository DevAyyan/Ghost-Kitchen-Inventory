import { useTour } from '@/lib/store/tour-store';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { FilterChip } from '@/components/common/filter-chip';
import { ResponsiveSheet } from '@/components/common/responsive-sheet';
import { Screen } from '@/components/common/screen';
import { AttentionCard } from '@/components/fridge/attention-card';
import { FridgeCabinet, useKitchen } from '@/components/fridge/fridge-cabinet';
import { ZoomOverlay } from '@/components/fridge/kitchen-scene';
import { ajarOf, sceneZones } from '@/lib/domain/kitchen-scene';
import { OpenCompartment } from '@/components/fridge/open-compartment';
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
import { VoiceButton, VoiceSheet } from '@/components/fridge/voice-sheet';
import { toast } from '@/lib/store/toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, List, Plus, Refrigerator, Search, X } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

const FILTERS = new Set<StageFilterValue>(['all', 'haunting', 'fresh', 'aging', 'expiring', 'rotting', 'spoiled']);

export default function FridgeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ stage?: string; q?: string; item?: string; demo?: string; tour?: string }>();
  const { isPhone, hasSidePanel } = useLayout();
  const items = useActiveItems();
  const counts = useStageCounts(items);
  const loadSampleData = useApp((s) => s.loadSampleData);
  const view = useSettings((s) => s.settings.fridgeView);
  const updateSettings = useSettings((s) => s.update);
  const act = useFridgeActions(items);
  const [buryOpen, setBuryOpen] = React.useState(false);
  const [keyOpen, setKeyOpen] = React.useState(false);
  const [quickId, setQuickId] = React.useState<string | null>(null);
  // Doors with food turning behind them stand ajar. Counted over everything stored, not just the filter.
  const ajar = React.useMemo(() => ajarOf(sceneZones(items, items)), [items]);
  const kitchenDoor = useKitchen(ajar);

  const filter = (FILTERS.has(params.stage as StageFilterValue) ? params.stage : 'all') as StageFilterValue;
  const q = params.q ?? '';
  const selected = items.find((i) => i.id === params.item) ?? null;
  const quick = items.find((i) => i.id === quickId) ?? null;
  const setParams = (p: Record<string, string | undefined>) => router.setParams(p);
  const visible = items.filter((i) => matches(i, filter, q));
  const select = (id: string) => setParams({ item: params.item === id && hasSidePanel ? undefined : id });
  const closeItem = () => setParams({ item: undefined });
  const kitchen = view !== 'list';
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  // A search in the address (a shared link, or Back) keeps the field open.
  const searching = searchOpen || q !== '';
  const openZone = kitchenDoor.door.phase === 'inside' ? kitchenDoor.door.zone : null;

  // Demo link (`/?demo=1`, see README): fills an empty fridge with the sample data, once, then drops the
  // parameter so a reload or a shared link doesn't keep adding more.
  const demo = params.demo === '1' || params.tour === '1';
  const tour = params.tour === '1';
  React.useEffect(() => {
    if (!demo) return;
    // The demo link also turns on demo mode, so scanning and recipes work with no server or internet.
    useSettings.getState().update({ demoMode: true });
    if (items.length === 0) { loadSampleData(); if (!tour) toast('Demo fridge loaded. Demo mode is on; turn it off and delete the samples in Settings.'); }
    // The tour link skips the welcome sheet: the tour tells the same story, step by step.
    if (tour) { useSettings.getState().update({ introSeen: true }); useTour.getState().start(); }
    // replace, not setParams: on web setParams leaves an emptied parameter in the address bar.
    router.replace('/');
  }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <View className="flex-row items-center gap-2">
          {/* Phones: search folds into this button and the two view buttons into one, so the kitchen starts
              a row higher. Wider screens keep the search field and both view buttons below. */}
          {isPhone && (
            <>
              <Button
                variant="outline"
                className="h-11 w-11 px-0"
                accessibilityLabel={searching ? 'Close search' : 'Search the fridge'}
                aria-expanded={searching}
                onPress={() => { if (searching) setParams({ q: undefined }); setSearchOpen(!searching); }}>
                <Icon as={searching ? X : Search} size={16} />
              </Button>
              <Button
                variant="outline"
                className="h-11 w-11 px-0"
                accessibilityLabel={kitchen ? 'Show as a use-first list' : 'Show as the kitchen'}
                onPress={() => updateSettings({ fridgeView: kitchen ? 'list' : 'kitchen' })}>
                <Icon as={kitchen ? List : Refrigerator} size={16} />
              </Button>
            </>
          )}
          <VoiceButton compact={isPhone} onPress={() => setVoiceOpen(true)} />
          {/* Adding food is one place: the Scan screen (photo, receipt, or by hand). */}
          <Button
            variant="outline"
            className={isPhone ? 'h-11 w-11 px-0' : 'h-11'}
            accessibilityLabel="Add food"
            onPress={() => router.navigate('/scan')}>
            <Icon as={Plus} size={16} />
            {!isPhone && <Text>Add food</Text>}
          </Button>
        </View>
      }>
      {(!isPhone || searching) && (
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
              autoFocus={isPhone}
            />
          </View>
          {!isPhone && (
            <View role="radiogroup" aria-label="Show the fridge as" className="flex-row gap-1">
              <FilterChip pressed={kitchen} onPress={() => updateSettings({ fridgeView: 'kitchen' })} accessibilityLabel="Kitchen view">
                <Icon as={Refrigerator} size={16} className={kitchen ? 'text-primary' : 'text-muted-foreground'} />
              </FilterChip>
              <FilterChip pressed={!kitchen} onPress={() => updateSettings({ fridgeView: 'list' })} accessibilityLabel="Use-first list">
                <Icon as={List} size={16} className={!kitchen ? 'text-primary' : 'text-muted-foreground'} />
              </FilterChip>
            </View>
          )}
        </View>
      )}
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
          art="ghost"
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
        <FridgeCabinet kitchen={kitchenDoor} items={visible} allItems={items} filtered={filter !== 'all' || q !== ''} onSelect={select} />
      ) : (
        <UseFirstList items={visible} onOpen={select} onUsed={act.usedAll} onBinned={act.binned} />
      )}

      <TonightCard items={items} />
      <VoiceSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </Screen>
  );

  return (
    <View className="flex-1 flex-row">
      <View className="flex-1">
        {/* An open compartment takes the whole page, so every item in it is in view. */}
        {kitchen && openZone ? (
          <OpenCompartment
            zone={openZone}
            items={visible}
            selectedId={selected?.id ?? null}
            onSelect={select}
            onQuick={setQuickId}
            filtered={filter !== 'all' || q !== ''}
            onClose={kitchenDoor.close}
            onSwitch={kitchenDoor.switchTo}
            counts={{ freezer: visible.filter((i) => i.zone === 'freezer').length, fridge: visible.filter((i) => i.zone === 'fridge').length, pantry: visible.filter((i) => i.zone === 'pantry').length }}
          />
        ) : body}
      </View>
      <ZoomOverlay door={kitchenDoor.door} rect={kitchenDoor.rect} ajar={ajar} />

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
