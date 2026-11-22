import { cn } from '@/lib/utils';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { banded } from '@/lib/banded';

type Stops = readonly [string, string, ...string[]];

interface GradientProps extends ViewProps {
  colors: Stops;
  /** Left → right instead of top → bottom. */
  horizontal?: boolean;
  className?: string;
}

/** A View with a banded (pixel-art) gradient painted behind its children, so NativeWind classes still style the box. */
export function Gradient({ colors, horizontal, className, children, ...rest }: GradientProps) {
  const bands = React.useMemo(() => banded(colors), [colors]);
  return (
    <View className={cn('overflow-hidden', className)} {...rest}>
      <LinearGradient
        colors={(bands?.colors ?? colors) as unknown as [string, string, ...string[]]}
        locations={bands ? (bands.locations as unknown as [number, number, ...number[]]) : undefined}
        start={{ x: 0, y: 0 }}
        end={horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
