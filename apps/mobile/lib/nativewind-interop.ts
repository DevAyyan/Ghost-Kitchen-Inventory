import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

/**
 * NativeWind only turns `className` into styles for components it knows. Reanimated's Animated.View
 * isn't one of them on web, so classes like "absolute inset-0" were silently dropped and effects fell
 * into normal layout. Registering it once makes className work alongside animated styles everywhere.
 * Imported for its side effect from app/_layout.tsx.
 */
cssInterop(Animated.View, { className: 'style' });
