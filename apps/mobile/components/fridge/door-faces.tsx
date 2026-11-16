import { Text } from '@/components/ui/text';
import { MATERIALS } from '@/lib/theme';
import * as React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Door artwork, drawn at whatever size the compartment behind it has grown to (it is measured, not a
 * fixed image), so a door always fits its shelves exactly. Purely decorative: the door's button carries
 * the label.
 */

function useSize() {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const onLayout = React.useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
  }, []);
  return { ...size, onLayout };
}

/** SVG gradient ids must be unique on a web page; useId gives ":r1:", which is not valid in url(#...). */
function useGradientId(prefix: string) {
  return `${prefix}${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** Brushed-steel fridge or freezer door: inset panel line, vertical bar handle on the opening (right) edge. */
export function SteelFace({ title }: { title: string }) {
  const { w, h, onLayout } = useSize();
  const steel = useGradientId('steel');
  const bar = useGradientId('bar');
  const handleH = Math.min(180, Math.max(36, h * 0.45));
  const handleY = (h - handleH) / 2;
  return (
    <View className="flex-1" onLayout={onLayout}>
      {w > 0 && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={steel} x1="0" y1="0" x2="1" y2="0">
              {MATERIALS.steel.map((c, i) => <Stop key={i} offset={i / (MATERIALS.steel.length - 1)} stopColor={c} />)}
            </LinearGradient>
            <LinearGradient id={bar} x1="0" y1="0" x2="1" y2="0">
              {MATERIALS.handle.map((c, i) => <Stop key={i} offset={i / (MATERIALS.handle.length - 1)} stopColor={c} />)}
            </LinearGradient>
          </Defs>
          <Rect width={w} height={h} rx={4} fill={`url(#${steel})`} />
          <Rect x={w * 0.06} width={w * 0.1} height={h} fill={MATERIALS.steelBrush} />
          <Rect x={6} y={6} width={Math.max(0, w - 12)} height={Math.max(0, h - 12)} rx={4} fill="none" stroke={MATERIALS.panelLine} />
          {/* Handle on brackets, so it reads as a handle and not a scrollbar */}
          <Rect x={w - 20} y={handleY - 6} width={8} height={6} rx={1.5} fill={MATERIALS.steel[2]} />
          <Rect x={w - 22} y={handleY} width={10} height={handleH} rx={3} fill={`url(#${bar})`} />
          <Rect x={w - 20} y={handleY + handleH} width={8} height={6} rx={1.5} fill={MATERIALS.steel[2]} />
        </Svg>
      )}
      <Text className="absolute left-3 top-2.5 text-xs font-bold uppercase tracking-wider" style={{ color: MATERIALS.engraveOnSteel }}>
        {title}
      </Text>
    </View>
  );
}

/** One leaf of the pantry's double doors: two raised panels, grain lines, a brass knob on the inner edge. */
export function WoodFace({ knob }: { knob: 'left' | 'right' }) {
  const { w, h, onLayout } = useSize();
  const wood = useGradientId('wood');
  const panelH = Math.max(0, (h - 30) / 2);
  const knobX = knob === 'right' ? w - 12 : 12;
  return (
    <View className="flex-1" onLayout={onLayout}>
      {w > 0 && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={wood} x1="0" y1="0" x2={knob === 'right' ? '1' : '0'} y2={knob === 'right' ? '0' : '1'}>
              {MATERIALS.woodPlank.map((c, i) => <Stop key={i} offset={i / (MATERIALS.woodPlank.length - 1)} stopColor={c} />)}
            </LinearGradient>
          </Defs>
          <Rect width={w} height={h} rx={3} fill={`url(#${wood})`} />
          {[0.22, 0.48, 0.71].map((x) => (
            <Line key={x} x1={w * x} y1={4} x2={w * x + 3} y2={h - 4} stroke={MATERIALS.woodGrain} strokeWidth={1} />
          ))}
          {[10, 20 + panelH].map((y) => (
            <Rect key={y} x={12} y={y} width={Math.max(0, w - 24)} height={panelH} rx={2} fill={MATERIALS.woodPanel} stroke={MATERIALS.panelLine} strokeWidth={1.5} />
          ))}
          <Circle cx={knobX} cy={h / 2} r={5} fill={MATERIALS.brass[0]} stroke={MATERIALS.brass[1]} strokeWidth={1.5} />
        </Svg>
      )}
    </View>
  );
}
