import { ResponsiveSheet } from '@/components/common/responsive-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { daysLeft, isCookable, remainingText } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { formatQty } from '@/lib/domain/units';
import { CircleCheck, PanelRightOpen, Trash2 } from 'lucide-react-native';
import { View } from 'react-native';

/** Press-and-hold on a fridge tile: the two common outcomes, without opening the full item sheet. */
export function QuickSheet({ item, onClose, onUsed, onBinned, onDetails }: {
  item: Item | null;
  onClose: () => void;
  onUsed: (item: Item) => void;
  onBinned: (item: Item) => void;
  onDetails: (id: string) => void;
}) {
  return (
    <ResponsiveSheet
      open={!!item}
      onClose={onClose}
      title={item?.name ?? ''}
      description={item ? `${formatQty(item.qty * item.fraction, item.unit)} · ${remainingText(daysLeft(item)).toLowerCase()}` : undefined}>
      {item && (
        <View className="gap-2 pb-2">
          {isCookable(item) && (
            <Button className="h-12" onPress={() => { onUsed(item); onClose(); }}>
              <Icon as={CircleCheck} size={18} className="text-primary-foreground" />
              <Text>Used it all</Text>
            </Button>
          )}
          <Button variant="outline" className="h-12" onPress={() => { onBinned(item); onClose(); }}>
            <Icon as={Trash2} size={18} />
            <Text>Binned it</Text>
          </Button>
          <Button variant="ghost" className="h-12" onPress={() => { onClose(); onDetails(item.id); }}>
            <Icon as={PanelRightOpen} size={18} />
            <Text>More: some used, dates, move</Text>
          </Button>
        </View>
      )}
    </ResponsiveSheet>
  );
}
