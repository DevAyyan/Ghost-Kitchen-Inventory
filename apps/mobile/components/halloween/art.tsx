import * as React from 'react';
import { Platform, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ART_XML, type ArtName } from './art-data';

export type { ArtName };

const NATIVE_HIDDEN =
  Platform.OS === 'web' ? {} : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);

/**
 * A Halloween illustration (Fluent Emoji, flat). Always decorative: it sits beside text that says the same
 * thing, so screen readers skip it. Never used for food, which is shown with the user's photos.
 */
export const Art = React.memo(function Art({ name, size, className }: { name: ArtName; size: number; className?: string }) {
  return (
    <View aria-hidden {...NATIVE_HIDDEN} pointerEvents="none" className={className} style={{ width: size, height: size }}>
      <SvgXml xml={ART_XML[name]} width={size} height={size} />
    </View>
  );
});
