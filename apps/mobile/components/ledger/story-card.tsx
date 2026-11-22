import { ResponsiveSheet } from '@/components/common/responsive-sheet';
import { Art } from '@/components/halloween/art';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { shortDate } from '@/lib/domain/dates';
import { formatCo2 } from '@/lib/domain/impact';
import type { WeekSummary } from '@/lib/domain/weekly';
import { shareText } from '@/lib/share';
import { shareViewAsImage } from '@/lib/share-image';
import { toast } from '@/lib/store/toast';
import { Image as ImageIcon, Share2 } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/**
 * The week as a picture to share. Fixed colours and size, so the image looks the same on every device.
 * It shows counts and money only: no photos, no names, nothing about food past its date.
 */
export function StorySheet({ open, onClose, w, rescued, wasted, co2SavedKg, text }: {
  open: boolean; onClose: () => void; w: WeekSummary; rescued: string; wasted: string; co2SavedKg: number; text: string;
}) {
  const ref = React.useRef<View>(null);
  const [busy, setBusy] = React.useState(false);

  const asImage = async () => {
    setBusy(true);
    const res = await shareViewAsImage(ref, `ghost-kitchen-week-${w.start}.png`, 'My week in the haunted kitchen');
    setBusy(false);
    if (res === 'downloaded') toast('Picture saved. Share it from your downloads.');
    else if (res === 'failed') toast("Couldn't make the picture here. Share it as text instead.");
    if (res === 'shared' || res === 'downloaded') onClose();
  };
  const asText = async () => {
    const res = await shareText('My week in the haunted kitchen', text);
    if (res === 'copied') toast('Your week is copied. Paste it anywhere.');
    else if (res === 'failed') toast("Couldn't share right now. Try again.");
    if (res === 'shared' || res === 'copied') onClose();
  };

  return (
    <ResponsiveSheet
      open={open}
      onClose={onClose}
      title="Share your week"
      description="A picture of your week. No photos or names are included."
      footer={
        <View className="flex-row flex-wrap gap-2">
          <Button className="h-11" disabled={busy} onPress={() => void asImage()}>
            <Icon as={ImageIcon} size={16} className="text-primary-foreground" /><Text>Share picture</Text>
          </Button>
          <Button variant="outline" className="h-11" onPress={() => void asText()}>
            <Icon as={Share2} size={16} /><Text>Share as text</Text>
          </Button>
        </View>
      }>
      {/* collapsable={false}: Android must keep this as a real view for it to be captured. */}
      <View ref={ref} collapsable={false} accessible accessibilityLabel={text} style={{ width: 320, backgroundColor: '#120e15', borderColor: '#3bf1a6', borderWidth: 4, padding: 20, gap: 12, alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Art name="ghost" size={40} />
          <View style={{ flex: 1 }}>
            <Text className="font-display" style={{ color: '#f2ecf7', fontSize: 22 }}>Ghost Kitchen</Text>
            <Text style={{ color: '#b9adc4', fontSize: 14 }}>{shortDate(w.start)} – {shortDate(w.end)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label="Ghosts banished" value={String(w.rescuedCount)} sub={rescued} color="#3bf1a6" />
          <Stat label="Buried" value={String(w.wastedCount)} sub={wasted} color="#ff5c7a" />
        </View>
        {co2SavedKg >= 0.1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Art name="moon" size={28} />
            <Text style={{ color: '#f2ecf7', fontSize: 15, flex: 1 }}>About {formatCo2(co2SavedKg)} of CO₂e kept out of the bin</Text>
          </View>
        )}
        {w.rescuedCount > 0 && w.wastedCount === 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Art name="headstone" size={28} />
            <Text style={{ color: '#f2ecf7', fontSize: 15, flex: 1 }}>The graveyard stayed empty.</Text>
          </View>
        )}
        <Text style={{ color: '#b9adc4', fontSize: 12 }}>Food rescued before it could turn.</Text>
      </View>
    </ResponsiveSheet>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View style={{ flex: 1, borderColor: color, borderWidth: 2, padding: 10, gap: 2 }}>
      <Text style={{ color: '#b9adc4', fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontSize: 28, fontWeight: 'bold' }}>{value}</Text>
      <Text style={{ color: '#f2ecf7', fontSize: 13 }} numberOfLines={1}>{sub}</Text>
    </View>
  );
}
