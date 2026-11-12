import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { addDays, daysBetween, shortDate } from '@/lib/domain/dates';
import { daysLeft, remainingText } from '@/lib/domain/expiry';
import type { IsoDate } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { CalendarCheck, CalendarClock, Minus, Plus } from 'lucide-react-native';
import { View } from 'react-native';

interface ExpiryFieldProps {
  expires: IsoDate;
  purchased: IsoDate;
  confirmed: boolean;
  sourceLabel: string;
  itemName: string;
  onChange: (expires: IsoDate) => void;
  onConfirm: () => void;
  /** Review rows: one-day steps only, smaller text. */
  compact?: boolean;
}

/**
 * Expiry date with day steppers and an explicit "Confirm" (FR-EXP-7).
 * An estimate is shown in warning colour with "Check the package" until the user confirms or adjusts it;
 * adjusting counts as confirming because the user chose the date.
 */
export function ExpiryField({ expires, purchased, confirmed, sourceLabel, itemName, onChange, onConfirm, compact }: ExpiryFieldProps) {
  const rem = daysLeft({ expires });
  const canEarlier = daysBetween(purchased, expires) > 0;
  const step = (n: number) => {
    const next = addDays(expires, n);
    onChange(daysBetween(purchased, next) < 0 ? purchased : next);
  };
  const steps = compact ? [-1, 1] : [-7, -1, 1, 7];

  return (
    <View
      className={cn(
        'gap-2 rounded-lg border p-3',
        confirmed ? 'border-border' : 'border-warning/70 bg-warning/5'
      )}>
      <View className="flex-row flex-wrap items-center gap-2">
        <Icon as={confirmed ? CalendarCheck : CalendarClock} size={16} className={confirmed ? 'text-stage-fresh' : 'text-warning'} />
        <View className="min-w-28 flex-1">
          <Text className={cn('font-semibold tabular-nums', compact && 'text-sm')}>
            {compact ? 'Expires ' : ''}{shortDate(expires)}
            <Text className="text-muted-foreground text-xs font-normal"> · {remainingText(rem).toLowerCase()}</Text>
          </Text>
          <Text className={cn('text-xs', confirmed ? 'text-muted-foreground' : 'text-warning')}>
            {confirmed ? sourceLabel : `${sourceLabel}. Check the date on the package.`}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          {steps.map((n) => (
            <Button
              key={n}
              variant="outline"
              size="icon"
              disabled={n < 0 && !canEarlier}
              onPress={() => step(n)}
              accessibilityLabel={`${itemName} expires ${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'} ${n < 0 ? 'earlier' : 'later'}`}
              className={cn('h-11', Math.abs(n) === 1 ? 'w-11' : 'w-12')}>
              {Math.abs(n) === 1 ? (
                <Icon as={n < 0 ? Minus : Plus} size={16} />
              ) : (
                <Text className="text-xs tabular-nums">{n < 0 ? '−7' : '+7'}</Text>
              )}
            </Button>
          ))}
        </View>
      </View>
      {!confirmed && (
        <Button variant="secondary" className="h-11 self-start" onPress={onConfirm} accessibilityLabel={`Confirm ${itemName} expires ${shortDate(expires)}`}>
          <Icon as={CalendarCheck} size={16} />
          <Text>Date is correct</Text>
        </Button>
      )}
    </View>
  );
}
