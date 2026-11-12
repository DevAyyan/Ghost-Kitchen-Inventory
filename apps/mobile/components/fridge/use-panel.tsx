import { SnapSlider } from '@/components/common/snap-slider';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/currency/money';
import type { Item } from '@/lib/domain/types';
import { formatQty, snapPoints } from '@/lib/domain/units';
import { useApp } from '@/lib/store/app-store';
import { toast } from '@/lib/store/toast';
import { CircleCheck } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** "How much did you use?" — snapping slider over what's left, then one button that says what it'll record. */
export function UsePanel({ item, onFinished }: { item: Item; onFinished: () => void }) {
  const consumeItem = useApp((s) => s.consumeItem);
  const left = item.qty * item.fraction;
  const points = React.useMemo(() => snapPoints(left, item.unit), [left, item.unit]);
  // Default to "all of it" for single things, the first step for packs.
  const [amount, setAmount] = React.useState(() => (points.length <= 2 ? left : points[1] ?? left));
  React.useEffect(() => setAmount(points.length <= 2 ? left : points[1] ?? left), [item.id, left, points]);

  const all = amount >= left - 1e-9;
  const use = () => {
    const res = consumeItem(item.id, amount);
    if (!res) return;
    const rescued = res.stage !== 'fresh' && res.value > 0 ? ` · ${formatMoney(res.value, item.currency)} rescued` : '';
    if (res.finished) {
      toast(`${item.name} laid to rest${rescued}`);
      onFinished();
    } else {
      toast(`Used ${formatQty(res.amount, item.unit)} of ${item.name}${rescued}`);
    }
  };

  return (
    <View className="gap-3">
      <SnapSlider
        label="How much did you use?"
        points={points}
        value={amount}
        onChange={setAmount}
        format={(v) => `${formatQty(v, item.unit)} of ${formatQty(left, item.unit)}`}
      />
      <Button className="h-11" disabled={!(amount > 0)} onPress={use}>
        <Icon as={CircleCheck} size={16} className="text-primary-foreground" />
        <Text>{all ? 'Used it all (lay to rest)' : `Use ${formatQty(amount, item.unit)}`}</Text>
      </Button>
    </View>
  );
}
