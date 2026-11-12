import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { snapTo } from '@/lib/domain/units';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react-native';
import * as React from 'react';
import { PanResponder, View, type GestureResponderEvent } from 'react-native';

interface SnapSliderProps {
  /** Allowed values, ascending. The thumb only ever rests on one of these. */
  points: number[];
  value: number;
  onChange: (value: number) => void;
  /** Visible + spoken text for a value, e.g. "3 of 12 eggs". */
  format: (value: number) => string;
  label: string;
}

/**
 * Slider that snaps to fixed positions. Drag or tap the track; −/+ step one position (also how keyboard
 * and screen-reader users adjust it). Built on PanResponder so it behaves the same on Android and web.
 */
export function SnapSlider({ points, value, onChange, format, label }: SnapSliderProps) {
  const track = React.useRef<View>(null);
  const geom = React.useRef({ pageX: 0, width: 1 });
  const last = points.length - 1;
  const index = Math.max(0, points.indexOf(snapTo(points, value)));
  const pct = last > 0 ? (index / last) * 100 : 0;

  // Keep the latest props for the gesture handlers, which are created once.
  const live = React.useRef({ points, onChange });
  live.current = { points, onChange };

  const pick = (e: GestureResponderEvent) => {
    const { pageX, width } = geom.current;
    const ratio = Math.min(1, Math.max(0, (e.nativeEvent.pageX - pageX) / width));
    const pts = live.current.points;
    const next = pts[Math.round(ratio * (pts.length - 1))] ?? 0;
    live.current.onChange(next);
  };

  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          // Re-measure on each touch (the sheet may have scrolled since layout); measuring is async, so
          // the first frame uses the last known position and the drag corrects itself straight after.
          track.current?.measure((_x, _y, width, _h, px) => { geom.current = { pageX: px, width: Math.max(1, width) }; });
          pick(e);
        },
        onPanResponderMove: (e) => pick(e),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const step = (dir: 1 | -1) => {
    const next = points[Math.min(last, Math.max(0, index + dir))];
    if (next !== undefined) onChange(next);
  };
  const ticks = points.length <= 25;

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm">{label}</Text>
        <Text className="text-sm font-semibold tabular-nums" aria-live="polite">{format(points[index] ?? 0)}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Button variant="outline" size="icon" className="h-11 w-11" disabled={index <= 0} onPress={() => step(-1)} accessibilityLabel="Less">
          <Icon as={Minus} size={16} />
        </Button>
        <View
          ref={track}
          onLayout={() => track.current?.measure((_x, _y, width, _h, px) => { geom.current = { pageX: px, width: Math.max(1, width) }; })}
          {...pan.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: last, now: index, text: format(points[index] ?? 0) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={index}
          aria-valuetext={format(points[index] ?? 0)}
          className="web:cursor-pointer h-11 flex-1 justify-center">
          <View className="bg-muted h-2 rounded-full">
            <View className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
          </View>
          {ticks && (
            <View pointerEvents="none" className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 flex-row justify-between px-px">
              {points.map((p, i) => (
                <View key={p} className={cn('h-2 w-0.5 rounded-full', i <= index ? 'bg-primary-foreground/40' : 'bg-muted-foreground/30')} />
              ))}
            </View>
          )}
          <View
            pointerEvents="none"
            className="border-primary bg-background absolute h-6 w-6 rounded-full border-2"
            style={{ left: `${pct}%`, marginLeft: -12 }}
          />
        </View>
        <Button variant="outline" size="icon" className="h-11 w-11" disabled={index >= last} onPress={() => step(1)} accessibilityLabel="More">
          <Icon as={Plus} size={16} />
        </Button>
      </View>
    </View>
  );
}
