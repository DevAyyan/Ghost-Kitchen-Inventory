import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { Screen } from '@/components/common/screen';
import { PlanSheet } from '@/components/plan/plan-sheet';
import { cookSummary, recipeItems, rescuedValue } from '@/components/recipes/cook-summary';
import { DietFilter } from '@/components/recipes/diet-filter';
import { Pager } from '@/components/recipes/pager';
import { RecipeCard, RecipeCardSkeleton } from '@/components/recipes/recipe-card';
import { AtRiskSummary } from '@/components/recipes/at-risk-summary';
import { PAGE_SIZE, useRecipeSearch } from '@/components/recipes/use-recipe-search';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isApiConfigured, type RemoteRecipe } from '@/lib/api';
import { DIETS, dietNotes } from '@/lib/domain/diets';
import { dayLabel } from '@/lib/domain/dates';
import { isAtRisk, isCookable, stageOf } from '@/lib/domain/expiry';
import { useActiveItems, useLayout } from '@/lib/hooks';
import { useSummarize } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { useServer } from '@/lib/store/server-store';
import { useSettings } from '@/lib/store/settings-store';
import { toast } from '@/lib/store/toast';
import { cn } from '@/lib/utils';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleAlert, CircleCheck, RefreshCw, Sparkles, UtensilsCrossed } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function RecipesScreen() {
  const router = useRouter();
  const { summon } = useLocalSearchParams<{ summon?: string }>();
  const { isPhone } = useLayout();
  const items = useActiveItems();
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const cookRecipe = useApp((s) => s.cookRecipe);
  const addPlan = useApp((s) => s.addPlan);
  const summarize = useSummarize();
  const scrollRef = React.useRef<ScrollView>(null);
  const { state, load, reset } = useRecipeSearch(scrollRef);
  const [cooking, setCooking] = React.useState<RemoteRecipe | null>(null);
  const [planning, setPlanning] = React.useState<RemoteRecipe | null>(null);
  const [cooked, setCooked] = React.useState<{ title: string; count: number; saved: string } | null>(null);

  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const search = (page = 1, opts?: Parameters<typeof load>[2]) => { setCooked(null); void load(settings.diets, page, opts); };

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
  const offline = useServer((s) => s.reachable === false) && configured;
  const checkServer = useServer((s) => s.check);
  // Find recipes is disabled while offline, so keep checking: it comes back on its own when the server does.
  React.useEffect(() => {
    if (!offline) return;
    const id = setInterval(() => void checkServer(), 20000);
    return () => clearInterval(id);
  }, [offline, checkServer]);

  // Don't make people press a button to see recipes: when something is turning, find them straight away.
  const autoLoaded = React.useRef(false);
  React.useEffect(() => {
    if (autoLoaded.current || state.kind !== 'idle' || !configured || offline || atRisk.length === 0) return;
    autoLoaded.current = true;
    void load(useSettings.getState().settings.diets, 1, { best: true });
  }, [state.kind, configured, offline, atRisk.length, load]);

  const confirmCook = () => {
    if (!cooking) return;
    const res = cookRecipe({ title: cooking.title, itemIds: recipeItems(cooking, byId).map((i) => i.id), uses: cooking.uses });
    const saved = summarize(res.saved).text;
    setCooked({ title: cooking.title, count: res.count, saved });
    toast(`${cooking.title} cooked · ${saved} of food rescued`);
    setCooking(null);
    reset();
  };

  return (
    <Screen needsServer
      scrollRef={scrollRef}
      title="Recipes from the brink"
      description="Real recipes from TheMealDB, chosen to use what's about to turn. Spoiled and unsafe food is never used."
      actions={
        <Button
          className="h-11"
          // First search: the best matches. "Find again": a fresh mix of other good ones.
          onPress={() => search(1, state.kind === 'done' ? { fresh: true } : { best: true })}
          // Offline it could only fail; the banner above says why.
          disabled={state.kind === 'loading' || !configured || offline || atRisk.length === 0}>
          <Icon as={state.kind === 'done' ? RefreshCw : Sparkles} size={16} className="text-primary-foreground" />
          <Text>{state.kind === 'done' ? 'Find again' : 'Find recipes'}</Text>
        </Button>
      }>
      <DietFilter
        collapsible
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
            {cooked.title} cooked. {cooked.count} ingredient{cooked.count === 1 ? '' : 's'} updated, about {cooked.saved} of food rescued.
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
          <Button variant="outline" className="mb-2 ml-6 mt-2 h-11 self-start" onPress={() => search(state.page)}><Text>Try again</Text></Button>
        </Alert>
      ) : state.kind === 'idle' ? (
        <AtRiskSummary items={atRisk} offline={offline} />
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
          {state.paging.page === 1 && state.recipes[0] && (
            <View className="gap-2">
              <Text role="heading" aria-level={2} className="text-lg font-semibold">Tonight</Text>
              <RecipeCard
                recipe={state.recipes[0]}
                items={byId}
                saves={summarize(rescuedValue(state.recipes[0], byId)).text}
                onCook={() => setCooking(state.recipes[0]!)}
                onPlan={() => setPlanning(state.recipes[0]!)}
                defaultOpen
              />
              {state.recipes.length > 1 && <Text role="heading" aria-level={2} className="pt-2 text-lg font-semibold">More ideas</Text>}
            </View>
          )}
          <View className={cn('gap-4', !isPhone && 'flex-row flex-wrap items-start')}>
            {(state.paging.page === 1 ? state.recipes.slice(1) : state.recipes).map((r) => (
              <RecipeCard key={r.id} recipe={r} items={byId} saves={summarize(rescuedValue(r, byId)).text} onCook={() => setCooking(r)} onPlan={() => setPlanning(r)} defaultOpen={false} />
            ))}
          </View>
          <Pager page={state.paging.page} pages={state.paging.pages} onChange={(p) => search(p)} />
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
            itemIds: recipeItems(planning, byId).map((i) => i.id),
            uses: planning.uses,
          });
          toast(`${planning.title} planned for ${dayLabel(date).toLowerCase()}. Missing ingredients are in Plan & shop.`);
        }}
      />
      <ConfirmDialog
        open={!!cooking}
        onOpenChange={(o) => !o && setCooking(null)}
        title={cooking ? `Cook ${cooking.title}?` : ''}
        description={cooking ? cookSummary(cooking, byId) : undefined}
        confirmLabel="Cook it"
        cancelLabel="Not yet"
        onConfirm={confirmCook}
      />
    </Screen>
  );
}
