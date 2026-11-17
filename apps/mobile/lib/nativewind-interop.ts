import { cssInterop } from 'nativewind';
import { Animated as RNAnimated } from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * NativeWind only turns `className` into styles for components it knows. Animated views (Reanimated's,
 * and React Native's own Animated.View used for swipe rows) aren't among them on web, so classes like
 * "absolute inset-0" or "flex-row" were silently dropped and layouts fell apart. Registering them once
 * makes className work alongside animated styles everywhere. Imported for its side effect from
 * app/_layout.tsx.
 */
cssInterop(Animated.View, { className: 'style' });
cssInterop(RNAnimated.View, { className: 'style' });
