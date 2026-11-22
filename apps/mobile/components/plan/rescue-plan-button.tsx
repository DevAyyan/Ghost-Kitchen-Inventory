import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api, ApiError, isApiConfigured, type RemoteRecipe } from '@/lib/api';
import { dayLabel, today } from '@/lib/domain/dates';
import { rescuePlan, rescueRequest, type PlannedDay } from '@/lib/domain/rescue-plan';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { toast } from '@/lib/store/toast';
import { CalendarRange } from 'lucide-react-native';
import * as React from 'react';

/**
 * "Plan the next 3 days": one search, then the planner picks the meals that together use the most turning
 * food. Shown for confirmation before anything is added to the plan.
 */
export function RescuePlanButton() {
  const addPlan = useApp((s) => s.addPlan);
  const [busy, setBusy] = React.useState(false);
  const [plan, setPlan] = React.useState<PlannedDay<RemoteRecipe>[] | null>(null);

  const make = async () => {
    const s = useSettings.getState().settings;
    const { usable, body } = rescueRequest(useApp.getState().items, s.diets, !s.tesseractOnly, today());
    setBusy(true);
    try {
      const res = await api.suggestRecipes(body);
      const days = rescuePlan(res.recipes, usable, today());
      if (days.length === 0) toast('No recipes use what is turning right now. Try again after your next shop.');
      else setPlan(days);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't plan right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    for (const d of plan ?? []) {
      addPlan({
        date: d.date, title: d.recipe.title, recipeId: d.recipe.id, thumb: d.recipe.thumb, sourceUrl: d.recipe.sourceUrl,
        ingredients: d.recipe.ingredients.map((g) => ({ name: g.name, measure: g.measure, staple: g.staple })),
        itemIds: [...new Set(d.recipe.ingredients.flatMap((g) => (g.itemId ? [g.itemId] : [])))],
        uses: d.recipe.uses,
      });
    }
    toast(`${plan?.length ?? 0} meals planned. Missing ingredients are on your shopping list below.`);
    setPlan(null);
  };

  if (!isApiConfigured()) return null;
  const description = (plan ?? [])
    .map((d) => `${dayLabel(d.date)}: ${d.recipe.title}${d.covers.length ? `, uses ${d.covers.map((i) => i.name).join(', ')}` : ''}`)
    .join('\n');

  return (
    <>
      <Button variant="outline" className="h-11" disabled={busy} onPress={() => void make()}>
        <Icon as={CalendarRange} size={16} />
        <Text>{busy ? 'Planning…' : 'Plan the next 3 days'}</Text>
      </Button>
      <ConfirmDialog
        open={!!plan}
        onOpenChange={(o) => !o && setPlan(null)}
        title={`${plan?.length ?? 0} meals that use what's turning`}
        description={description}
        confirmLabel="Add to plan"
        cancelLabel="Not now"
        onConfirm={save}
      />
    </>
  );
}
