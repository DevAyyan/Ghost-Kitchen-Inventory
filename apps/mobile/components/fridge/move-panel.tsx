import { FilterChip } from '@/components/common/filter-chip';
import { ExpiryField } from '@/components/food/expiry-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ZONES, ZONE_ORDER } from '@/lib/domain/catalog';
import { daysBetween, shortDate, today } from '@/lib/domain/dates';
import { planMove } from '@/lib/domain/storage';
import type { IsoDate, Item, Zone } from '@/lib/domain/types';
import { useApp } from '@/lib/store/app-store';
import { toast } from '@/lib/store/toast';
import { Archive, Ban, Info, Refrigerator, Snowflake, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

const ZONE_ICON: Record<Zone, LucideIcon> = { freezer: Snowflake, fridge: Refrigerator, pantry: Archive };

/** "Stored in" picker. Moving recalculates the expiry; the user sees and can confirm the new date first. */
export function MovePanel({ item }: { item: Item }) {
  const moveItem = useApp((s) => s.moveItem);
  const [target, setTarget] = React.useState<Zone | null>(null);
  const [date, setDate] = React.useState<{ expires: IsoDate; confirmed: boolean } | null>(null);

  React.useEffect(() => { setTarget(null); setDate(null); }, [item.id, item.zone]);

  const plan = target ? planMove(item, target) : null;
  const choose = (z: Zone) => {
    if (z === item.zone) { setTarget(null); setDate(null); return; }
    setTarget(z);
    const p = planMove(item, z);
    setDate(p.ok ? { expires: p.expires, confirmed: false } : null);
  };
  const commit = () => {
    if (!plan || !plan.ok || !date) return;
    // If the user nudged the date, keep the shelf length consistent with it.
    const shelf = Math.max(1, plan.shelfDays + daysBetween(plan.expires, date.expires));
    moveItem(item.id, plan.to, date.expires, shelf, date.confirmed);
    toast(`${item.name} moved to the ${ZONES[plan.to].label.toLowerCase()} · expires ${shortDate(date.expires)}`);
  };

  return (
    <View className="gap-3">
      <Text className="text-muted-foreground text-sm">Stored in</Text>
      <View role="radiogroup" aria-label="Storage section" className="flex-row flex-wrap gap-2">
        {ZONE_ORDER.map((z) => {
          const here = z === item.zone;
          const blocked = !here && !planMove(item, z).ok;
          return (
            <FilterChip
              key={z}
              pressed={here || z === target}
              onPress={() => choose(z)}
              accessibilityLabel={`${ZONES[z].label}${here ? ', current' : blocked ? ', not suitable' : ''}`}
              className={blocked ? 'opacity-60' : undefined}>
              <Icon as={blocked ? Ban : ZONE_ICON[z]} size={14} className={here ? 'text-primary' : 'text-muted-foreground'} />
              <Text className="text-sm">{ZONES[z].label}</Text>
              {here && <Text className="text-muted-foreground text-xs">now</Text>}
            </FilterChip>
          );
        })}
      </View>

      {plan && !plan.ok && (
        <Alert icon={Ban} variant="destructive">
          <AlertDescription>{plan.reason}</AlertDescription>
        </Alert>
      )}

      {plan && plan.ok && date && (
        <View className="gap-3">
          <Alert icon={Info}>
            <AlertDescription>{plan.note}</AlertDescription>
          </Alert>
          {plan.warning && (
            <Alert icon={TriangleAlert} iconClassName="text-warning">
              <AlertDescription>{plan.warning}</AlertDescription>
            </Alert>
          )}
          <ExpiryField
            expires={date.expires}
            purchased={today()}
            confirmed={date.confirmed}
            sourceLabel={date.confirmed ? 'Confirmed by you' : `New estimate for the ${ZONES[plan.to].label.toLowerCase()}`}
            itemName={item.name}
            onChange={(expires) => setDate({ expires, confirmed: true })}
            onConfirm={() => setDate((d) => (d ? { ...d, confirmed: true } : d))}
          />
          <View className="flex-row flex-wrap gap-2">
            <Button className="h-11 flex-1" onPress={commit}>
              <Icon as={ZONE_ICON[plan.to]} size={16} className="text-primary-foreground" />
              <Text>Move to {ZONES[plan.to].label}</Text>
            </Button>
            <Button variant="outline" className="h-11" onPress={() => choose(item.zone)}>
              <Text>Cancel</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
