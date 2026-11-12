import { cn } from '@/lib/utils';
import * as React from 'react';
import { Pressable } from 'react-native';

interface FilterChipProps {
  pressed: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Pill-shaped toggle chip. Used instead of the Reusables `Toggle` because that component forwards
 * its className into TextClassContext, which leaks container styles (height, border, bg) onto children.
 */
export function FilterChip({ pressed, onPress, accessibilityLabel, children, className }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: pressed }}
      aria-pressed={pressed}
      accessibilityLabel={accessibilityLabel}
      className={cn(
        'border-input web:hover:bg-accent active:bg-accent h-11 flex-row items-center gap-1.5 rounded-full border px-3 sm:h-9',
        'web:focus-visible:ring-2 web:focus-visible:ring-ring web:outline-none',
        pressed && 'border-primary bg-primary/10',
        className
      )}>
      {children}
    </Pressable>
  );
}
