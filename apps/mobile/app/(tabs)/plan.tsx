import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { Screen } from '@/components/common/screen';
import { ItemChip } from '@/components/plan/item-chip';
import { MealRow } from '@/components/plan/meal-row';
import { PlanSheet } from '@/components/plan/plan-sheet';
import { ShoppingCard } from '@/components/plan/shopping-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { dayLabel, today } from '@/lib/domain/dates';
import { planDays, plannedTooLate, unplannedAtRisk } from '@/lib/domain/plan';
import type { Item, PlanEntry } from '@/lib/domain/types';
import { useActiveItems, useLayout } from '@/lib/hooks';
import { useSummarize } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { useHousehold } from '@/lib/store/household-store';
import { toast } from '@/lib/store/toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'expo-router';
import { CalendarClock, CalendarPlus, ChefHat, Sparkles, Users } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

export default function PlanScreen() {
  const router = useRouter();
  const { isPhone } = useLayout();
  const now = today();
  const items = useActiveItems();
  const allItems = useApp((s) => s.items);
  const plan = useApp((s) => s.plan);
  const shopping = useApp((s) => s.shopping);
  const events = useApp((s) => s.events);
  const addPlan = useApp((s) => s.addPlan);
  const movePlan = useApp((s) => s.movePlan);
  const removePlan = useApp((s) => s.removePlan);
  const cookPlan = useApp((s) => s.cookPlan);
  const household = useHousehold((s) => s.household);
  const summarize = useSummarize();

  const [sheet, setSheet] = React.useState<{ kind: 'new' } | { kind: 'move'; entry: PlanEntry } | null>(null);
  const [cooking, setCooking] = React.useState<PlanEntry | null>(null);

  const byId = React.useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);
  const unplanned = unplannedAtRisk(items, plan, now);
  const tooLate = plannedTooLate(plan, items, now);
  const days = planDays(now);
  const upcoming = plan.filter((p) => p.date >= now);

  const confirmCook = () => {
    if (!cooking) return;
    const res = cookPlan(cooking.id);
    if (res) toast(`${cooking.title} cooked · ${res.count} ingredient${res.count === 1 ? '' : 's'} used${res.saved.length ? ` · ${summarize(res.saved).text} rescued` : ''}`);
    setCooking(null);
  };

  return (
    <Screen
      title="Plan & shop"
      description={household ? `Shared with ${household.name}. Plan meals around what's turning, and keep one shopping list.` : "Plan meals around what's turning, and keep a shopping list of what's missing."}
      actions={
        <Button className="h-11" onPress={() => setSheet({ kind: 'new' })}>
          <Icon as={CalendarPlus} size={16} className="text-primary-foreground" />
          <Text>Plan a meal</Text>
        </Button>
      }>
      {unplanned.length > 0 && (
        <Card className="border-stage-expiring/50 gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle role="heading" aria-level={2}>Turning, with no meal planned</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <View className="flex-row flex-wrap gap-1.5">{unplanned.map((i) => <ItemChip key={i.id} item={i} />)}</View>
            <View className="flex-row flex-wrap gap-2">
              <Button variant="outline" className="h-11" onPress={() => router.navigate({ pathname: '/recipes', params: { summon: '1' } })}>
                <Icon as={Sparkles} size={16} />
                <Text>Find recipes for these</Text>
              </Button>
              <Button variant="ghost" className="h-11" onPress={() => setSheet({ kind: 'new' })}>
                <Text>Plan my own meal</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      {tooLate.map((t) => (
        <Alert key={`${t.entry.id}-${t.item.id}`} icon={CalendarClock} iconClassName="text-warning" className="border-warning/60">
          <AlertTitle>{t.entry.title} is planned too late</AlertTitle>
          <AlertDescription>
            {t.item.name} will be past its date by {dayLabel(t.entry.date, now).toLowerCase()}{t.item.highRisk ? ', and it is high-risk food' : ''}.
          </AlertDescription>
          <Button variant="outline" className="mb-2 ml-6 mt-2 h-11 self-start" onPress={() => { movePlan(t.entry.id, t.moveTo); toast(`${t.entry.title} moved to ${dayLabel(t.moveTo, now).toLowerCase()}`); }}>
            <Text>Move to {dayLabel(t.moveTo, now).toLowerCase()}</Text>
          </Button>
        </Alert>
      ))}

      <View className={cn('gap-4', !isPhone && 'flex-row items-start')}>
        <Card className="flex-1 gap-2 py-4">
          <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>This week</CardTitle></CardHeader>
          <CardContent className="gap-1 px-4">
            {upcoming.length === 0 && (
              <EmptyState
                icon={ChefHat}
                title="No meals planned"
                description="Plan a recipe from the Recipes tab, or add your own meal. We'll flag food that turns before you get to it."
              />
            )}
            {upcoming.length > 0 && days.map((d) => {
              const meals = plan.filter((p) => p.date === d);
              return (
                <View key={d} className="border-border gap-2 border-b py-3 last:border-b-0">
                  <Text role="heading" aria-level={3} className={cn('text-sm font-semibold', d === now && 'text-primary')}>{dayLabel(d, now)}</Text>
                  {meals.length === 0 ? (
                    <Text className="text-muted-foreground text-sm">Nothing planned</Text>
                  ) : (
                    meals.map((m) => (
                      <MealRow key={m.id} entry={m} byId={byId} onCook={() => setCooking(m)} onMove={() => setSheet({ kind: 'move', entry: m })} onRemove={() => { removePlan(m.id); toast(`${m.title} removed from the plan`); }} />
                    ))
                  )}
                </View>
              );
            })}
          </CardContent>
        </Card>

        <ShoppingCard items={items} shopping={shopping} plan={plan} events={events} />
      </View>

      {household && (
        <View className="flex-row items-center gap-2">
          <Icon as={Users} size={14} className="text-muted-foreground" />
          <Text className="text-muted-foreground text-xs">Everyone in {household.name} sees the same plan and list.</Text>
        </View>
      )}

      <PlanSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        heading={sheet?.kind === 'move' ? `Move ${sheet.entry.title}` : 'Plan a meal'}
        custom={sheet?.kind === 'new'}
        initialDate={sheet?.kind === 'move' ? sheet.entry.date : undefined}
        confirmLabel={sheet?.kind === 'move' ? 'Move it' : 'Add to plan'}
        onSave={({ date, title, itemIds }) => {
          if (sheet?.kind === 'move') { movePlan(sheet.entry.id, date); toast(`Moved to ${dayLabel(date, now).toLowerCase()}`); return; }
          const used = itemIds.map((id) => byId.get(id)).filter((i): i is Item => !!i);
          addPlan({ date, title, itemIds, ingredients: used.map((i) => ({ name: i.name, measure: '', staple: false })) });
          toast(`${title} planned for ${dayLabel(date, now).toLowerCase()}`);
        }}
      />
      <ConfirmDialog
        open={!!cooking}
        onOpenChange={(o) => !o && setCooking(null)}
        title={cooking ? `Cook ${cooking.title}?` : ''}
        description={cooking ? cookText(cooking, byId) : undefined}
        confirmLabel="Lay them to rest"
        cancelLabel="Not yet"
        onConfirm={confirmCook}
      />
    </Screen>
  );
}

function cookText(p: PlanEntry, byId: Map<string, Item>) {
  const used = p.itemIds.map((id) => byId.get(id)).filter((i): i is Item => !!i && i.status === 'active');
  if (!used.length) return 'Nothing from the fridge is linked to this meal. It will just be marked as cooked.';
  return `Uses ${used.map((i) => i.name).join(', ')} from the fridge${used.some((i) => i.multiUse) ? ' (half of packs that last several meals)' : ''}.`;
}
