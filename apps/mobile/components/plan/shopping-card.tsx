import { EmptyState } from '@/components/common/empty-state';
import { FilterChip } from '@/components/common/filter-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { today } from '@/lib/domain/dates';
import { inStock, missingForPlan, usedUpSuggestions } from '@/lib/domain/shopping';
import type { Item, ItemEvent, PlanEntry, ShoppingItem } from '@/lib/domain/types';
import { formatQty } from '@/lib/domain/units';
import { useApp } from '@/lib/store/app-store';
import { toast } from '@/lib/store/toast';
import { cn } from '@/lib/utils';
import { ListChecks, Plus, ShoppingBasket, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

/** The (shared) shopping list, with suggestions from the meal plan and from food that ran out. */
export function ShoppingCard({
  items, shopping, plan, events, className,
}: { items: Item[]; shopping: ShoppingItem[]; plan: PlanEntry[]; events: ItemEvent[]; className?: string }) {
  const now = today();
  const addShopping = useApp((s) => s.addShopping);
  const toggle = useApp((s) => s.toggleShopping);
  const remove = useApp((s) => s.removeShopping);
  const clearChecked = useApp((s) => s.clearCheckedShopping);
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');

  const missing = missingForPlan(plan, items, shopping, now);
  const usedUp = usedUpSuggestions(events, items, shopping, now);
  const open = shopping.filter((l) => !l.checked);
  const done = shopping.filter((l) => l.checked);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (!addShopping(n, { amount })) toast(`${n} is already on the list`);
    setName('');
    setAmount('');
  };
  const addAllMissing = () => {
    const n = missing.filter((m) => addShopping(m.name, { amount: m.measure, source: 'plan' })).length;
    toast(`${n} item${n === 1 ? '' : 's'} added from your meal plan`);
  };

  return (
    <Card className={cn('gap-2 py-4', className)}>
      <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>Shopping list</CardTitle></CardHeader>
      <CardContent className="gap-3 px-4">
        <View className="flex-row flex-wrap gap-2">
          <Input value={name} onChangeText={setName} onSubmitEditing={add} placeholder="Add an item" accessibilityLabel="Item to buy" returnKeyType="done" maxLength={80} className="h-11 min-w-40 flex-1" />
          <Input value={amount} onChangeText={setAmount} onSubmitEditing={add} placeholder="Amount" accessibilityLabel="Amount (optional)" maxLength={40} className="h-11 w-28" />
          <Button variant="outline" className="h-11" onPress={add} disabled={!name.trim()} accessibilityLabel="Add to shopping list">
            <Icon as={Plus} size={16} /><Text>Add</Text>
          </Button>
        </View>

        {shopping.length === 0 ? (
          <EmptyState inCard icon={ShoppingBasket} title="Nothing to buy yet" description="Add things here, or from an item's details when you finish it." />
        ) : (
          <View role="list">
            {[...open, ...done].map((l) => <ShoppingRow key={l.id} line={l} have={inStock(l.name, items)} onToggle={() => toggle(l.id)} onRemove={() => remove(l.id)} />)}
          </View>
        )}
        {done.length > 0 && (
          <Button variant="ghost" className="h-11 self-start" onPress={() => { const n = clearChecked(); toast(`${n} ticked item${n === 1 ? '' : 's'} cleared`); }}>
            <Icon as={ListChecks} size={16} /><Text>Clear ticked ({done.length})</Text>
          </Button>
        )}

        {missing.length > 0 && (
          <View className="border-border gap-2 rounded-lg border p-3">
            <Text role="heading" aria-level={3} className="text-sm font-semibold">Missing for your planned meals</Text>
            <Text className="text-muted-foreground text-sm">{missing.map((m) => m.name).join(', ')}</Text>
            <Button variant="outline" className="h-11 self-start" onPress={addAllMissing}>
              <Icon as={Plus} size={16} /><Text>Add all {missing.length}</Text>
            </Button>
          </View>
        )}
        {usedUp.length > 0 && (
          <View className="gap-2">
            <Text role="heading" aria-level={3} className="text-sm font-semibold">Used up recently</Text>
            <View className="flex-row flex-wrap gap-2">
              {usedUp.map((n) => (
                <FilterChip key={n} pressed={false} onPress={() => { addShopping(n, { source: 'used-up' }); toast(`${n} added`); }} accessibilityLabel={`Add ${n} to the shopping list`}>
                  <Icon as={Plus} size={14} />
                  <Text className="text-sm">{n}</Text>
                </FilterChip>
              ))}
            </View>
          </View>
        )}
      </CardContent>
    </Card>
  );
}

function ShoppingRow({ line, have, onToggle, onRemove }: { line: ShoppingItem; have: Item[]; onToggle: () => void; onRemove: () => void }) {
  const left = have.reduce((n, i) => n + i.qty * i.fraction, 0);
  return (
    <View role="listitem" className="border-border min-h-12 flex-row items-center gap-2 border-b last:border-b-0">
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: line.checked }}
        aria-checked={line.checked}
        accessibilityLabel={`${line.name}${line.amount ? `, ${line.amount}` : ''}`}
        className="min-h-12 flex-1 flex-row items-center gap-3 py-2 web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
        <Checkbox checked={line.checked} onCheckedChange={onToggle} aria-hidden tabIndex={-1} focusable={false} importantForAccessibility="no-hide-descendants" />
        <View className="flex-1 gap-0.5">
          <Text className={cn('text-sm', line.checked && 'text-muted-foreground line-through')}>
            {line.name}{line.amount ? <Text className="text-muted-foreground text-sm"> · {line.amount}</Text> : null}
          </Text>
          {have.length > 0 && !line.checked && (
            <Text className="text-muted-foreground text-xs">You still have {have[0]!.unit === 'pcs' ? Math.round(left * 10) / 10 : formatQty(left, have[0]!.unit)} in the fridge</Text>
          )}
        </View>
      </Pressable>
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${line.name}`} className="active:bg-accent h-11 w-11 items-center justify-center rounded-md web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none">
        <Icon as={Trash2} size={16} className="text-muted-foreground" />
      </Pressable>
    </View>
  );
}
