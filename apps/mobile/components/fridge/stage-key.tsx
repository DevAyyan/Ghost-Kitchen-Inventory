import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Stage } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { Flame, Info, Layers, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

/** Plain-language meaning of each stage. Mirrors stageOf() in lib/domain/expiry.ts. Also used by the food hover card. */
export const STAGE_MEANING: Record<Stage, string> = {
  fresh: 'More than half of its shelf life left.',
  aging: 'Between a quarter and half of its shelf life left. Plan to use it soon.',
  expiring: '2 days or less left, or under a quarter of its shelf life. Use it first.',
  rotting: 'Up to 3 days past its date. Use today only if it looks and smells fine.',
  spoiled: 'More than 3 days past its date, or any meat, fish, dairy, eggs or leftovers past their date. Throw it out.',
};

const ORDER: Stage[] = ['fresh', 'aging', 'expiring', 'rotting', 'spoiled'];

/** Opens and closes the freshness key. An icon button that sits at the end of the filter chips. */
export function StageKeyToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel="What do these filters mean?"
      className={cn(
        'border-border h-11 w-11 items-center justify-center rounded-full border web:hover:bg-accent active:bg-accent web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring',
        open && 'bg-accent'
      )}>
      <Icon as={Info} size={16} className={open ? 'text-foreground' : 'text-muted-foreground'} />
    </Pressable>
  );
}

/** The freshness key itself: what each filter chip means. Shown below the chips when toggled open. */
export function StageKeyPanel() {
  return (
    <View role="list" aria-label="Freshness key" className="border-border bg-card gap-2.5 rounded-lg border p-3">
      <Row icon={Layers} iconClass="text-muted-foreground" label="All" text="Everything in the freezer, fridge and pantry." />
      <Row icon={Flame} iconClass="text-stage-expiring" label="Haunting" text="Needs attention now: expiring, rotting and spoiled items together." />
      {ORDER.map((s) => (
        <Row key={s} icon={STAGE_STYLE[s].icon} iconClass={STAGE_STYLE[s].text} label={STAGE_STYLE[s].label} text={STAGE_MEANING[s]} />
      ))}
      <Text className="text-muted-foreground pt-1 text-xs">
        The number on each chip is how many items are in that group. Stages follow each item's expiry date, so confirm dates against the package.
      </Text>
    </View>
  );
}

function Row({ icon, iconClass, label, text }: { icon: LucideIcon; iconClass: string; label: string; text: string }) {
  return (
    <View role="listitem" className="flex-row items-start gap-2.5">
      <View className="w-24 flex-row items-center gap-1.5 pt-0.5">
        <Icon as={icon} size={14} className={cn(iconClass)} />
        <Text className="text-sm font-semibold">{label}</Text>
      </View>
      <Text className="text-muted-foreground flex-1 text-sm">{text}</Text>
    </View>
  );
}
