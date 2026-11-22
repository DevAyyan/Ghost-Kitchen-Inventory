import { onTick } from '@/components/fridge/pixel-effects';
import { Text } from '@/components/ui/text';
import { formatMoney, type MoneySummary } from '@/lib/currency/money';
import { countUpAt } from '@/lib/domain/count-up';
import { useMotionAllowed } from '@/lib/hooks';
import * as React from 'react';


/**
 * A money figure that counts up from zero when it first shows or changes. Only single-currency figures
 * animate; mixed ones ("£4 + €3") and reduced motion show the final text straight away. Screen readers
 * get the final figure from the first frame.
 */
export function CountUpMoney({ summary, currency, className, numberOfLines }: { summary: MoneySummary; currency: string; className?: string; numberOfLines?: number }) {
  const motion = useMotionAllowed();
  const target = summary.value;
  const [shown, setShown] = React.useState<number | null>(motion && target !== null ? 0 : target);
  React.useEffect(() => {
    if (!motion || target === null || target === 0) { setShown(target); return; }
    const start = Date.now();
    setShown(0);
    const off = onTick((now) => {
      const p = countUpAt(now - start);
      setShown(Math.round(target * p));
      if (p >= 1) off();
    });
    return off;
  }, [target, motion]);
  const text = target === null || shown === null ? summary.text : formatMoney(shown, currency);
  return <Text className={className} numberOfLines={numberOfLines} accessibilityLabel={summary.text}>{text}</Text>;
}
