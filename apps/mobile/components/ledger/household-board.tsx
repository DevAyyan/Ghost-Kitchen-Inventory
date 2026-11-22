import { GhostAvatar } from '@/components/profile/ghost-avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { api, type HouseholdMember } from '@/lib/api';
import { today, weekStart } from '@/lib/domain/dates';
import { householdBoard } from '@/lib/domain/weekly';
import { useApp } from '@/lib/store/app-store';
import { useHousehold } from '@/lib/store/household-store';
import { useSettings } from '@/lib/store/settings-store';
import * as React from 'react';
import { View } from 'react-native';

/**
 * This week's rescues per person in a shared household. Hidden until two people have done something, and
 * when the member list can't be loaded (offline, demo mode): names are needed, and ids mean nothing.
 */
export function HouseholdBoard() {
  const household = useHousehold((s) => s.household);
  const demo = useSettings((s) => s.settings.demoMode);
  const events = useApp((s) => s.events);
  const [people, setPeople] = React.useState<HouseholdMember[] | null>(null);
  const key = household?.key;
  React.useEffect(() => {
    if (!key || demo) return;
    let live = true;
    api.householdMembers(key).then((r) => live && setPeople(r.people)).catch(() => {});
    return () => { live = false; };
  }, [key, demo]);

  const rows = React.useMemo(() => householdBoard(events, weekStart(today())), [events]);
  if (!household || !people || rows.length < 2) return null;
  const byId = new Map(people.map((p) => [p.userId, p]));
  const named = rows.filter((r) => byId.has(r.by));
  if (named.length < 2) return null;
  const top = named[0]!.rescued;

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>Ghost hunters this week</CardTitle></CardHeader>
      <CardContent className="gap-2 px-4">
        <View role="list" className="gap-2">
          {named.map((r, n) => {
            const p = byId.get(r.by)!;
            const lead = top > 0 && r.rescued === top;
            return (
              <View key={r.by} role="listitem" accessible accessibilityLabel={`${p.you ? 'You' : p.displayName}: ${r.rescued} rescued, ${r.buried} buried${lead ? ', leading' : ''}`} className="flex-row items-center gap-3">
                <Text className="text-muted-foreground w-5 text-right tabular-nums">{n + 1}</Text>
                <GhostAvatar avatar={p.avatar} size={28} />
                <Text className="flex-1 text-sm" numberOfLines={1}>{p.you ? `${p.displayName} (you)` : p.displayName}{lead ? ' 👑' : ''}</Text>
                <Text className="text-stage-fresh text-sm tabular-nums">{r.rescued} rescued</Text>
                <Text className="text-muted-foreground w-20 text-right text-xs tabular-nums">{r.buried} buried</Text>
              </View>
            );
          })}
        </View>
        <Text className="text-muted-foreground text-xs">Counts food used while it was turning. Burying spoiled food is the right call and never counts against anyone.</Text>
      </CardContent>
    </Card>
  );
}
