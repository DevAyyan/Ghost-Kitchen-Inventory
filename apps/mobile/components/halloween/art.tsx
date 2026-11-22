import * as React from 'react';
import { Image, Platform, View, type ImageStyle } from 'react-native';

export type ArtName = 'ghost' | 'pumpkin' | 'bat' | 'headstone' | 'moon' | 'candle' | 'crystalBall' | 'trophy';

const NATIVE_HIDDEN =
  Platform.OS === 'web' ? {} : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);

/** 16 px pixel illustrations (scripts/make-pixel-assets.py); the ghost is one of the ghost sprites. */
const ART: Record<ArtName, number> = {
  ghost: require('@/assets/sprites/ghosts/ghost-4.png'),
  pumpkin: require('@/assets/sprites/art/pumpkin.png'),
  bat: require('@/assets/sprites/art/bat.png'),
  headstone: require('@/assets/sprites/art/headstone.png'),
  moon: require('@/assets/sprites/art/moon.png'),
  candle: require('@/assets/sprites/art/candle.png'),
  crystalBall: require('@/assets/sprites/art/crystalBall.png'),
  trophy: require('@/assets/sprites/art/trophy.png'),
};

const pixelated: ImageStyle = Platform.OS === 'web' ? ({ imageRendering: 'pixelated' } as ImageStyle) : {};

/**
 * A Halloween illustration in pixel art. Always decorative: it sits beside text that says the same thing, so
 * screen readers skip it. Never used for food, which is shown with the user's photos.
 */
export const Art = React.memo(function Art({ name, size, className }: { name: ArtName; size: number; className?: string }) {
  return (
    <View aria-hidden {...NATIVE_HIDDEN} pointerEvents="none" className={className} style={{ width: size, height: size }}>
      <Image source={ART[name]} fadeDuration={0} style={[{ width: size, height: size, resizeMode: 'stretch' }, pixelated]} />
    </View>
  );
});
