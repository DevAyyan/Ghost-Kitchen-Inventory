import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import type { MoveSuggestion } from '@/lib/domain/suggest';
import type { Item } from '@/lib/domain/types';
import { CalendarClock, ChevronDown, ChevronUp, Ghost, PackageSearch, Snowflake, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

interface AttentionCardProps {
  spoiled: Item[];
  /** Dates still estimated on food that's starting to turn, most urgent first. */
  estimated: Item[];
  /** Food that a move would save, with what to do (freezing first). */
  moves: { item: Item; suggestion: MoveSuggestion }[];
  /** Full and untouched for weeks: probably eaten without logging, or lost at the back. */
  forgotten: Item[];
  onBury: () => void;
  onOpen: (id: string) => void;
  onMove: (item: Item, suggestion: MoveSuggestion) => void;
}

const names = (items: Item[], max = 2) =>
  `${items.slice(0, max).map((i) => i.name).join(', ')}${items.length > max ? ` +${items.length - max}` : ''}`;

type Row = { key: string; icon: LucideIcon; iconClass: string; title: string; detail: string; action: string; onPress: () => void };

/**
 * Every decision that needs you, most urgent first. Only the top one shows; the rest fold under "N more",
 * so the fridge stays near the top of the screen. One short line per row: the item sheet explains.
 */
export function AttentionCard({ spoiled, estimated, moves, forgotten, onBury, onOpen, onMove }: AttentionCardProps) {
  const [all, setAll] = React.useState(false);
  const rows: Row[] = [];
  if (spoiled.length > 0) {
    rows.push({
      key: 'spoiled', icon: Ghost, iconClass: 'text-stage-spoiled',
      title: `${spoiled.length} spoiled`, detail: names(spoiled), action: `Bury ${spoiled.length}`, onPress: onBury,
    });
  }
  const first = moves[0];
  if (first) {
    const freeze = first.suggestion.kind === 'save';
    rows.push({
      key: 'move', icon: Snowflake, iconClass: freeze ? 'text-stage-expiring' : 'text-muted-foreground',
      title: first.suggestion.title, detail: first.suggestion.detail,
      action: freeze ? 'Freeze' : 'Move', onPress: () => onMove(first.item, first.suggestion),
    });
  }
  if (estimated.length > 0) {
    rows.push({
      key: 'estimated', icon: CalendarClock, iconClass: 'text-warning',
      title: `Check ${estimated.length === 1 ? '1 date' : `${estimated.length} dates`}`, detail: `${names(estimated)} · estimated`,
      action: 'Check', onPress: () => onOpen(estimated[0]!.id),
    });
  }
  if (forgotten.length > 0) {
    rows.push({
      key: 'forgotten', icon: PackageSearch, iconClass: 'text-muted-foreground',
      title: 'Still have these?', detail: `${names(forgotten)} · untouched for weeks`,
      action: 'Review', onPress: () => onOpen(forgotten[0]!.id),
    });
  }
  if (rows.length === 0) return null;
  const shown = all ? rows : rows.slice(0, 1);
  const hidden = rows.length - shown.length;

  return (
    <View role="region" aria-label="Needs attention" className="border-border bg-card rounded-lg border">
      {shown.map((r, i) => (
        <React.Fragment key={r.key}>
          {i > 0 && <Separator />}
          <View className="min-h-14 flex-row items-center gap-3 py-2 pl-3 pr-2">
            <Icon as={r.icon} size={20} className={r.iconClass} />
            <View className="min-w-0 flex-1">
              <Text className="font-semibold" numberOfLines={1}>{r.title}</Text>
              <Text className="text-muted-foreground text-sm" numberOfLines={1}>{r.detail}</Text>
            </View>
            <Button variant="outline" className="h-11 px-3" onPress={r.onPress} accessibilityLabel={`${r.action}: ${r.title}`}>
              <Text>{r.action}</Text>
            </Button>
          </View>
        </React.Fragment>
      ))}
      {rows.length > 1 && (
        <>
          <Separator />
          <Pressable
            onPress={() => setAll((a) => !a)}
            accessibilityRole="button"
            accessibilityState={{ expanded: all }}
            className="h-11 flex-row items-center justify-center gap-1 web:hover:bg-accent web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring">
            <Text className="text-muted-foreground text-sm">{all ? 'Show less' : `${hidden} more to do`}</Text>
            <Icon as={all ? ChevronUp : ChevronDown} size={14} className="text-muted-foreground" />
          </Pressable>
        </>
      )}
    </View>
  );
}
