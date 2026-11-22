import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ZONES } from '@/lib/domain/catalog';
import { stageOf } from '@/lib/domain/expiry';
import type { Item, Zone } from '@/lib/domain/types';
import { useLayout, useMotionAllowed } from '@/lib/hooks';
import { isHaunting } from '@/lib/domain/expiry';
import { PIXEL } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { DoorClosed } from 'lucide-react-native';
import * as React from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SpiritsNote } from './spirits-note';
import { byUrgency } from './fridge-cabinet';
import { OPEN_DOORS } from './kitchen-sprites';
import { pixelated, PixelLamp, PixelTexture, PX, useStutter } from './pixel-effects';
import { Shelves } from './shelves';

interface OpenCompartmentProps {
  zone: Zone;
  /** What's shown on the shelves (after search and stage filters). */
  items: Item[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onQuick?: (id: string) => void;
  filtered: boolean;
  onClose: () => void;
  /** Go to another compartment without closing this one first. */
  onSwitch?: (zone: Zone) => void;
  /** Items shown in each compartment, for the tabs. */
  counts?: Record<Zone, number>;
}

const TABS: Zone[] = ['fridge', 'freezer', 'pantry'];

/**
 * An open fridge, freezer or pantry, filling the page, drawn as pixel art in the graded sprite's palette: a
 * thick outline, a one-pixel bevel (light top-left, dark bottom-right), a tiled back wall and pixel shelves.
 * The fridge and freezer lamp flickers now and then. The shelves scroll inside; the Close button and the
 * Android back button both shut the door.
 */
export function OpenCompartment({ zone, items, selectedId, onSelect, onQuick, filtered, onClose, onSwitch, counts }: OpenCompartmentProps) {
  const motion = useMotionAllowed();
  const c = PIXEL[zone];
  const here = items.filter((i) => i.zone === zone).sort(byUrgency);
  const spirits = here.filter((i) => stageOf(i) === 'spoiled').length;
  const haunted = here.some((i) => isHaunting(stageOf(i)));
  const { isPhone } = useLayout();
  const closeRef = React.useRef<View>(null);

  React.useEffect(() => {
    const id = setTimeout(() => closeRef.current?.focus?.(), 0);
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => { clearTimeout(id); sub.remove(); };
  }, [onClose]);

  const label = `${ZONES[zone].label}, ${here.length} items${spirits ? `, ${spirits} spoiled` : ''}`;
  return (
    <Animated.View entering={motion ? FadeIn.duration(220) : undefined} className="flex-1 p-2 md:p-4">
      <View className="flex-1 flex-row items-start">
      <View role="group" aria-label={label} className="flex-1 self-stretch" style={{ backgroundColor: PIXEL.outline, padding: 4 }}>
        {/* Bevel: lit from the top left, like the sprite. */}
        <View
          className="flex-1 gap-2 p-2"
          style={{ backgroundColor: c.body, borderWidth: 3, borderTopColor: c.shelfTop, borderLeftColor: c.shelfTop, borderBottomColor: c.edge, borderRightColor: c.edge }}>
          <View className="flex-row items-center gap-2 pl-1">
            <View className="flex-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <Text role="heading" aria-level={2} className="font-heading text-base uppercase tracking-wider" style={{ color: c.text }}>
                {ZONES[zone].label} · {here.length}
              </Text>
              <Text className="text-xs" style={{ color: c.text }}>{ZONES[zone].temp}</Text>
              <SpiritsNote count={spirits} />
            </View>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={`Close the ${ZONES[zone].label.toLowerCase()} door`}
              className="h-11 min-w-11 flex-row items-center justify-center gap-1 border-b-4 px-3 active:border-b-2 web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring"
              style={{ backgroundColor: PIXEL.outline, borderBottomColor: '#000' }}>
              <Icon as={DoorClosed} size={16} className="text-white" />
              <Text className="text-sm font-semibold text-white">Close</Text>
            </Pressable>
          </View>
          {onSwitch && (
            <View role="tablist" aria-label="Compartments" className="flex-row gap-1">
              {TABS.map((z) => {
                const on = z === zone;
                const tc = PIXEL[z];
                return (
                  <Pressable
                    key={z}
                    role="tab"
                    aria-selected={on}
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${ZONES[z].label}, ${counts?.[z] ?? 0} items`}
                    onPress={() => onSwitch(z)}
                    className={cn(
                      'h-11 flex-1 flex-row items-center justify-center gap-1.5 border-2 px-2 web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring',
                      on ? 'border-b-0' : 'border-b-4 opacity-80 active:border-b-2',
                    )}
                    // Each tab in its own compartment's colours, so the switch reads at a glance.
                    style={{ backgroundColor: on ? tc.inside : tc.body, borderColor: PIXEL.outline }}>
                    <Text className="text-sm font-semibold" style={{ color: on ? tc.insideText : tc.text }}>{ZONES[z].label}</Text>
                    <Text className="text-xs tabular-nums" style={{ color: on ? tc.insideText : tc.text }}>{counts?.[z] ?? 0}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {/* The inside: recessed, so the bevel flips (dark top-left). */}
          <View
            className="flex-1 overflow-hidden"
            style={{ backgroundColor: c.inside, borderWidth: 3, borderTopColor: c.edge, borderLeftColor: c.edge, borderBottomColor: c.shelfTop, borderRightColor: c.shelfTop }}>
            <PixelTexture source={PX.wall[zone]} />
            {zone !== 'pantry' && <PixelLamp haunted={spirits > 0} />}
            <ScrollView className="flex-1" contentContainerClassName="pb-4 pt-2">
              <Shelves
                items={here}
                selectedId={selectedId}
                onSelect={onSelect}
                onQuick={onQuick}
                kind={zone}
                minShelves={zone === 'freezer' ? 2 : 4}
                filtered={filtered}
              />
            </ScrollView>
          </View>
        </View>
      </View>
      {/* The door, swung open on its hinge beside the shelves (wide screens; phones need the width). */}
      {!isPhone && <OpenDoor zone={zone} haunted={haunted} />}
      </View>
    </Animated.View>
  );
}

/** The open door in pixel art, its inside lit by the haunted light while anything in here is turning. */
function OpenDoor({ zone, haunted }: { zone: Zone; haunted: boolean }) {
  const d = OPEN_DOORS[zone];
  const level = useStutter(haunted, 0.35);
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" className="w-40" style={{ aspectRatio: d.aspect }}>
      <Image source={d.door} fadeDuration={0} style={[StyleSheet.absoluteFill, pixelated, { width: '100%', height: '100%', resizeMode: 'stretch' }]} />
      {haunted && (
        <Image source={d.light} fadeDuration={0} style={[StyleSheet.absoluteFill, pixelated, { width: '100%', height: '100%', resizeMode: 'stretch', opacity: level }]} />
      )}
    </View>
  );
}
