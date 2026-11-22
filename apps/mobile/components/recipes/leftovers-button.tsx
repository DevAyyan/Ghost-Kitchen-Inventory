import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { daysLeft } from '@/lib/domain/expiry';
import { useApp } from '@/lib/store/app-store';
import { toast } from '@/lib/store/toast';
import { Archive, Check } from 'lucide-react-native';
import * as React from 'react';

/**
 * "Save leftovers" after a meal is cooked: one tap puts them on the fridge's shelves, so they get the same
 * reminders and stages as everything else instead of being forgotten at the back.
 */
export function LeftoversButton({ title }: { title: string }) {
  const addLeftovers = useApp((s) => s.addLeftovers);
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => setSaved(false), [title]);
  if (saved) {
    return (
      <Button variant="ghost" disabled className="h-11 self-start">
        <Icon as={Check} size={16} className="text-stage-fresh" />
        <Text>Leftovers in the fridge</Text>
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      className="h-11 self-start"
      onPress={() => {
        const id = addLeftovers(title);
        const item = useApp.getState().items.find((i) => i.id === id);
        const days = item ? daysLeft(item) : 2;
        setSaved(true);
        toast(`Leftovers saved. Eat within ${days} day${days === 1 ? '' : 's'}, and check the date in the fridge.`);
      }}>
      <Icon as={Archive} size={16} />
      <Text>Save leftovers</Text>
    </Button>
  );
}
