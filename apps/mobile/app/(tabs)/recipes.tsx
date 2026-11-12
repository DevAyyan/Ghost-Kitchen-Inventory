import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { Screen } from '@/components/common/screen';
import { DietFilter } from '@/components/recipes/diet-filter';
import { PlanSheet } from '@/components/plan/plan-sheet';
import { Pager } from '@/components/recipes/pager';
import { RecipeCard, RecipeCardSkeleton } from '@/components/recipes/recipe-card';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api, ApiError, isApiConfigured, type RemoteRecipe } from '@/lib/api';
import { STAGE_META } from '@/lib/domain/catalog';
import { DIETS, dietNotes, type Diet } from '@/lib/domain/diets';
import { dayLabel } from '@/lib/domain/dates';
import { daysLeft, isAtRisk, isCookable, shortRemaining, stageOf } from '@/lib/domain/expiry';
import type { Item, Money } from '@/lib/domain/types';
import { useActiveItems, useLayout } from '@/lib/hooks';
import { useSummarize } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { useServer } from '@/lib/store/server-store';
import { toast } from '@/lib/store/toast';
import { cn } from '@/lib/utils';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleAlert, CircleCheck, RefreshCw, Sparkles, UtensilsCrossed } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

/** Urgency sent to the server: Fresh 1 … Rotting 4. Spoiled and unsafe food is never sent. */
const urgencyOf = (i: Item) => STAGE_META[stageOf(i)].weight;

/** Money this recipe rescues: the remaining value of non-fresh items it uses (half for multi-use packs). */
function rescuedValue(r: RemoteRecipe, byId: Map<string, Item>): Money[] {
  return r.rescuesItemIds.flatMap((id) => {
    const i = byId.get(id);
    return i ? [{ minor: Math.round(i.priceMinor * i.fraction * (i.multiUse ? 0.5 : 1)), currency: i.currency }] : [];
  });
}

/** Recipes per page. The server ranks the whole list once; each page is a stable slice of it. */
const PAGE_SIZE = 10;

type Paging = { page: number; pages: number; total: number };
type State =
  | { kind: 'idle' }
  /** `paging` is the page being left, so the pager stays put (disabled) while the next one loads. */
  | { kind: 'loading'; paging?: Paging }
  | { kind: 'done'; recipes: RemoteRecipe[]; warnings: string[]; paging: Paging }
  | { kind: 'error'; message: string; page: number };

export default function RecipesScreen() {
  const router = useRouter();
  const { summon } = useLocalSearchParams<{ summon?: string }>();
  const { isPhone } = useLayout();
  const items = useActiveItems();
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const cookRecipe = useApp((s) => s.cookRecipe);
  const markUnreachable = useServer((s) => s.markUnreachable);
  const summarize = useSummarize();
  const [state, setState] = React.useState<State>({ kind: 'idle' });
  const [cooking, setCooking] = React.useState<RemoteRecipe | null>(null);
  const [planning, setPlanning] = React.useState<RemoteRecipe | null>(null);
  const addPlan = useApp((s) => s.addPlan);
  const [cooked, setCooked] = React.useState<{ title: string; count: number; saved: string } | null>(null);
  const reqId = React.useRef(0);
  const scrollRef = React.useRef<ScrollView>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  /** Fetches one page (always from the server, so going back shows exactly that page's recipes again). */
  const load = React.useCallback(async (diets: Diet[], page = 1) => {
    const id = ++reqId.current;
    setCooked(null);
    const prev = stateRef.current;
    setState({ kind: 'loading', paging: prev.kind === 'done' && page !== 1 ? prev.paging : undefined });
    if (page !== 1) scrollRef.current?.scrollTo({ y: 0, animated: false });
    const usable = useApp.getState().items.filter((i) => i.status === 'active' && isCookable(i));
    try {
      const res = await api.suggestRecipes({
        items: usable.map((i) => ({ id: i.id, name: i.name, urgency: urgencyOf(i) })),
        diets, limit: PAGE_SIZE, page, useAi: !useSettings.getState().settings.tesseractOnly,
      });
      if (id !== reqId.current) return;
      // The fridge may have changed since the last page (something cooked): stay within the real range.
      if (res.recipes.length === 0 && page > 1 && res.page.pages > 0) {
        void load(diets, res.page.pages);
        return;
      }
      setState({
        kind: 'done', recipes: res.recipes, warnings: res.warnings,
        paging: { page: res.page.number, pages: res.page.pages, total: res.page.total },
      });
    } catch (e) {
      if (id !== reqId.current) return;
      const err = e instanceof ApiError ? e : null;
      if (err?.code === 'offline') markUnreachable(err.message);
      setState({ kind: 'error', message: err?.message ?? 'Could not load recipes.', page });
    }
  }, [markUnreachable]);

  React.useEffect(() => {
    if (summon === '1') {
      router.setParams({ summon: undefined });
      void load(useSettings.getState().settings.diets);
    }
  }, [summon, router, load]);

  const atRisk = items.filter((i) => isAtRisk(stageOf(i)) && isCookable(i));
  const notes = dietNotes(settings.diets);
  const dietLabel = settings.diets.map((d) => DIETS[d].label).join(' + ');
  const configured = isApiConfigured();

  const confirmCook = () => {
    if (!cooking) return;
    const itemIds = cooking.ingredients.flatMap((ing) => (ing.itemId && !ing.staple ? [ing.itemId] : []));
    const res = cookRecipe({ title: cooking.title, itemIds });
    const saved = summarize(res.saved).text;
    setCooked({ title: cooking.title, count: res.count, saved });
    toast(`${res.count} ingredient${res.count === 1 ? '' : 's'} laid to rest · ${saved} rescued`);
    setCooking(null);
    setState({ kind: 'idle' });
  };

  return (
    <Screen
      scrollRef={scrollRef}
      title="Recipes from the brink"
      description="Real recipes from TheMealDB, chosen to use what's about to turn. Spoiled and unsafe food is never used."
      actions={
        <Button className="h-11" onPress={() => void load(settings.diets)} disabled={state.kind === 'loading' || !configured || atRisk.length === 0}>
          <Icon as={state.kind === 'done' ? RefreshCw : Sparkles} size={16} className="text-primary-foreground" />
          <Text>{state.kind === 'done' ? 'Find again' : 'Find Recipes'}</Text>
        </Button>
      }>
      <DietFilter
        value={settings.diets}
        onChange={(diets) => {
          updateSettings({ diets });
          if (state.kind === 'done') void load(diets);
        }}
      />
      {notes.length > 0 && <Text className="text-muted-foreground text-xs">{notes.join(' ')}</Text>}

      {!configured && (
        <Alert icon={CircleAlert}>
          <AlertTitle>Recipes need your Ghost Kitchen server</AlertTitle>
          <AlertDescription>Add the server address in Settings to get recipes.</AlertDescription>
          <Button variant="outline" className="mb-2 ml-6 mt-2 h-11 self-start" onPress={() => router.navigate('/settings')}><Text>Open Settings</Text></Button>
        </Alert>
      )}
      {cooked && (
        <Alert icon={CircleCheck} iconClassName="text-stage-fresh" className="border-stage-fresh/40">
          <AlertDescription className="text-foreground">
            {cooked.title} cooked. {cooked.count} ingredient{cooked.count === 1 ? '' : 's'} laid to rest, about {cooked.saved} of food rescued.
          </AlertDescription>
        </Alert>
      )}

      {state.kind === 'loading' ? (
        <>
          <View aria-busy aria-label={state.paging ? 'Loading the next page of recipes' : 'Finding recipes'} className={cn('gap-4', !isPhone && 'flex-row flex-wrap')}>
            <RecipeCardSkeleton /><RecipeCardSkeleton /><RecipeCardSkeleton /><RecipeCardSkeleton />
          </View>
          {state.paging && <Pager page={state.paging.page} pages={state.paging.pages} onChange={() => undefined} disabled />}
        </>
      ) : state.kind === 'error' ? (
        <Alert icon={CircleAlert} variant="destructive">
          <AlertTitle>Couldn't load recipes</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
          <Button variant="outline" className="mb-2 ml-6 mt-2 h-11 self-start" onPress={() => void load(settings.diets, state.page)}><Text>Try again</Text></Button>
        </Alert>
      ) : state.kind === 'idle' ? (
        <View className="border-border bg-card gap-3 rounded-lg border p-4">
          <Text role="heading" aria-level={2} className="font-semibold">
            {atRisk.length ? `${atRisk.length} ingredient${atRisk.length === 1 ? ' is' : 's are'} close to turning` : 'Nothing urgent right now'}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {atRisk.map((i) => {
              const s = STAGE_STYLE[stageOf(i)];
              return (
                <View key={i.id} className={cn('flex-row items-center gap-1 rounded-full border px-2 py-1', s.border)}>
                  <Icon as={s.icon} size={12} className={s.text} />
                  <Text className="text-xs">{i.name} · {shortRemaining(daysLeft(i))}</Text>
                </View>
              );
            })}
          </View>
          <Text className="text-muted-foreground text-sm">
            {atRisk.length ? "Tap Find and we'll look for recipes that use these first." : 'Recipes appear here when food in your fridge starts to turn.'}
          </Text>
        </View>
      ) : state.recipes.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title={settings.diets.length ? `No ${dietLabel} recipes fit what you have` : 'No recipes fit what you have'}
          description={state.warnings[0] ?? 'Try fewer filters, or add more groceries.'}
          action={settings.diets.length ? (
            <Button variant="outline" className="h-11" onPress={() => { updateSettings({ diets: [] }); void load([]); }}><Text>Clear diet filters</Text></Button>
          ) : undefined}
        />
      ) : (
        <>
          {state.warnings.map((w) => <Text key={w} className="text-muted-foreground text-xs">{w}</Text>)}
          <Text role="status" aria-live="polite" className="text-muted-foreground text-xs">
            {state.paging.pages > 1
              ? `Page ${state.paging.page} of ${state.paging.pages} · ${state.paging.total} recipes`
              : `${state.paging.total} recipe${state.paging.total === 1 ? '' : 's'}${state.paging.total < PAGE_SIZE ? ' (all the good matches)' : ''}`}
            {' · '}Recipes and photos from TheMealDB{settings.diets.length ? ` · ${dietLabel}, checked by Gemini` : ''}
          </Text>
          <View className={cn('gap-4', !isPhone && 'flex-row flex-wrap items-start')}>
            {state.recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} items={byId} saves={summarize(rescuedValue(r, byId)).text} onCook={() => setCooking(r)} onPlan={() => setPlanning(r)} defaultOpen={false} />
            ))}
          </View>
          <Pager page={state.paging.page} pages={state.paging.pages} onChange={(p) => void load(settings.diets, p)} />
        </>
      )}

      <PlanSheet
        open={!!planning}
        onClose={() => setPlanning(null)}
        heading={planning ? `Plan ${planning.title}` : 'Plan'}
        confirmLabel="Add to plan"
        onSave={({ date }) => {
          if (!planning) return;
          addPlan({
            date, title: planning.title, recipeId: planning.id, thumb: planning.thumb, sourceUrl: planning.sourceUrl,
            ingredients: planning.ingredients.map((g) => ({ name: g.name, measure: g.measure, staple: g.staple })),
            itemIds: [...new Set(planning.ingredients.flatMap((g) => (g.itemId && !g.staple ? [g.itemId] : [])))],
          });
          toast(`${planning.title} planned for ${dayLabel(date).toLowerCase()}. Missing ingredients are in Plan & shop.`);
        }}
      />
      <ConfirmDialog
        open={!!cooking}
        onOpenChange={(o) => !o && setCooking(null)}
        title={cooking ? `Cook ${cooking.title}?` : ''}
        description={cooking ? cookSummary(cooking, byId) : undefined}
        confirmLabel="Lay them to rest"
        cancelLabel="Not yet"
        onConfirm={confirmCook}
      />
    </Screen>
  );
}

function cookSummary(r: RemoteRecipe, byId: Map<string, Item>): string {
  const used = [...new Set(r.ingredients.flatMap((g) => (g.itemId && !g.staple ? [g.itemId] : [])))].map((id) => byId.get(id)).filter((i): i is Item => !!i);
  const all = used.filter((i) => !i.multiUse).map((i) => i.name);
  const half = used.filter((i) => i.multiUse).map((i) => i.name);
  return [
    all.length ? `Used up: ${all.join(', ')}.` : '',
    half.length ? `Half used: ${half.join(', ')}.` : '',
    r.missing.length ? `You'll still need ${r.missing.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
}
