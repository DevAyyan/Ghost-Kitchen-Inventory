import { cn } from '@/lib/utils';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

type Stops = readonly [string, string, ...string[]];

interface GradientProps extends ViewProps {
  colors: Stops;
  /** Left → right instead of top → bottom. */
  horizontal?: boolean;
  className?: string;
}

/** A View with a gradient painted behind its children, so NativeWind classes still style the box. */
export function Gradient({ colors, horizontal, className, children, ...rest }: GradientProps) {
  return (
    <View className={cn('overflow-hidden', className)} {...rest}>
      <LinearGradient
        colors={colors as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
