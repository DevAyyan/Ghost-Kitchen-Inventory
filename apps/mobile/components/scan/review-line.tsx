import { ExpiryField } from '@/components/food/expiry-field';
import { FoodPhoto } from '@/components/food/food-photo';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { currencyInfo } from '@/lib/currency/catalog';
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/domain/catalog';
import { LOW_CONFIDENCE, type DraftLine, needsExpiry, parseQty, reestimate, withInfo } from '@/lib/domain/draft';
import { UNITS, UNIT_LABEL, isUnit } from '@/lib/domain/units';
import { EXPIRY_SOURCE_LABEL } from '@/lib/domain/expiry';
import type { IsoDate } from '@/lib/domain/types';
import { captureFoodPhoto } from '@/lib/photos';
import { useLessons } from '@/lib/hooks';
import { lookupProducts } from '@/lib/products';
import { useScan } from '@/lib/store/scan-store';
import { toast } from '@/lib/store/toast';
import { cn } from '@/lib/utils';
import { Camera, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

/** One editable receipt line: photo, name, qty, price, category and its expiry date to confirm. */
export const ReviewLine = React.memo(function ReviewLine({
  line, currency, purchased,
}: { line: DraftLine; currency: string; purchased: IsoDate }) {
  const patch = useScan((s) => s.patchLine);
  const remove = useScan((s) => s.removeLine);
  const low = !line.manual && line.confidence < LOW_CONFIDENCE;
  const conf = Math.round(line.confidence * 100);
  const { symbol } = currencyInfo(currency);
  const name = line.name || 'this row';

  const lessons = useLessons();
  const onName = (text: string) => patch(line.id, { name: text, info: undefined });
  /** When the user finishes typing a name, ask for its shelf life (cached; falls back to the category). */
  const lookUp = async () => {
    const name = line.name.trim();
    if (!name || line.nonFood || line.info !== undefined) return;
    const { info } = await lookupProducts([name]);
    const current = useScan.getState().draft?.lines.find((l) => l.id === line.id);
    if (!current || current.name.trim() !== name) return; // edited again meanwhile
    patch(line.id, withInfo(current, info.get(name) ?? null, purchased, lessons));
  };
  const onCategory = (category: DraftLine['category']) => {
    patch(line.id, { category, ...reestimate({ ...line, category }, purchased, lessons) });
  };
  const takePhoto = async () => {
    const res = await captureFoodPhoto('camera');
    if (!res) return;
    if ('error' in res) toast(res.error);
    else patch(line.id, { photoUri: res.uri });
  };

  return (
    <View
      role="listitem"
      className={cn(
        'border-border bg-card gap-2 border-b p-3',
        low && 'border-l-warning bg-warning/5 border-l-4',
        !line.include && 'opacity-60'
      )}>
      <View className="flex-row flex-wrap items-center gap-2">
        <Checkbox checked={line.include} onCheckedChange={(v) => patch(line.id, { include: v })} accessibilityLabel={`Include ${name}`} />
        {!line.nonFood && (
          <Pressable
            onPress={takePhoto}
            accessibilityRole="button"
            accessibilityLabel={line.photoUri ? `Retake photo of ${name}` : `Take a photo of ${name}`}
            className="relative">
            <FoodPhoto photoUri={line.photoUri} category={line.category} name={line.name} size="sm" className="h-11 w-11" />
            {!line.photoUri && (
              <View className="bg-primary absolute -bottom-1 -right-1 h-5 w-5 items-center justify-center rounded-full">
                <Icon as={Camera} size={11} className="text-primary-foreground" />
              </View>
            )}
          </Pressable>
        )}
        <View className="min-w-40 flex-[2] gap-1">
          <Input value={line.name} onChangeText={onName} onEndEditing={() => void lookUp()} onBlur={() => void lookUp()} placeholder="Item name" accessibilityLabel="Item name" className="h-11" />
          {(line.raw || line.nonFood) && (
            <Text className="text-muted-foreground font-mono text-xs" numberOfLines={1}>
              {line.raw ? `“${line.raw}”` : ''}{line.nonFood ? ' · non-food, not stocked' : ''}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-1">
          <Input
            value={line.qty}
            onChangeText={(t) => {
              // Counted items are whole numbers; weights and volumes may have decimals.
              const clean = line.unit === 'pcs' ? t.replace(/[^0-9]/g, '') : t.replace(/[^0-9.,]/g, '');
              patch(line.id, { qty: clean });
            }}
            keyboardType={line.unit === 'pcs' ? 'number-pad' : 'decimal-pad'}
            placeholder="1"
            accessibilityLabel={`Amount of ${name} in ${UNIT_LABEL[line.unit]}`}
            aria-invalid={!line.nonFood && !Number.isFinite(parseQty(line.qty))}
            className="h-11 w-16 text-center"
          />
          <Select
            value={{ value: line.unit, label: UNIT_LABEL[line.unit] }}
            onValueChange={(o) => {
              if (!o || !isUnit(o.value)) return;
              // Switching to pieces drops decimals, so "1.5" kg doesn't become "1.5" eggs.
              const qty = o.value === 'pcs' ? String(Math.max(1, Math.round(parseQty(line.qty) || 1))) : line.qty;
              patch(line.id, { unit: o.value, qty });
            }}>
            <SelectTrigger className="h-11 w-20" accessibilityLabel={`Unit for ${name}`}>
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent className="w-24">
              {UNITS.map((u) => (
                <SelectItem key={u} value={u} label={UNIT_LABEL[u]} />
              ))}
            </SelectContent>
          </Select>
        </View>
        <View className="w-32 flex-row items-center gap-1">
          <Text className="text-primary w-8 text-right font-semibold">{symbol}</Text>
          <Input
            value={line.price}
            onChangeText={(t) => patch(line.id, { price: t.replace(/[^0-9.,]/g, '') })}
            keyboardType="decimal-pad"
            placeholder="0"
            accessibilityLabel={`Price of ${name} in ${currency}`}
            className="h-11 flex-1"
          />
        </View>
        <Select
          value={{ value: line.category, label: CATEGORY_LABEL[line.category] }}
          onValueChange={(o) => o && onCategory(o.value as DraftLine['category'])}>
          <SelectTrigger className="h-11 w-36" accessibilityLabel={`Type of ${name}`}>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="w-40">
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} label={CATEGORY_LABEL[c]} />
            ))}
          </SelectContent>
        </Select>
        {/* A typed row has no reading confidence; the empty slot keeps columns lined up on wide screens. */}
        {line.manual ? (
          <View aria-hidden className="w-12" />
        ) : (
          <Text
            accessibilityLabel={`${conf}% reading confidence`}
            className={cn('w-12 text-center text-xs font-bold tabular-nums', conf >= 85 ? 'text-stage-fresh' : conf >= 70 ? 'text-stage-aging' : 'text-warning')}>
            {`${conf}%`}
          </Text>
        )}
        <Button variant="ghost" size="icon" className="h-11 w-11" onPress={() => remove(line.id)} accessibilityLabel={`Remove ${name}`}>
          <Icon as={Trash2} size={16} className="text-muted-foreground" />
        </Button>
      </View>

      {needsExpiry(line) && (
        <ExpiryField
          compact
          expires={line.expires}
          purchased={purchased}
          confirmed={line.expiryConfirmed}
          sourceLabel={line.expiryConfirmed ? 'Confirmed' : EXPIRY_SOURCE_LABEL[line.expirySource]}
          itemName={name}
          onChange={(expires) => patch(line.id, { expires, expiryConfirmed: true, expirySource: 'user' })}
          onConfirm={() => patch(line.id, { expiryConfirmed: true })}
        />
      )}
    </View>
  );
});
