import { PixelTexture, PX, useFrames } from '@/components/fridge/pixel-effects';
import { cn } from '@/lib/utils';
import { View } from 'react-native';

/**
 * A loading placeholder in pixel art: a dithered block that blinks between two shades in steps, like an
 * old screen drawing. Still under reduced motion.
 */
function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  const f = useFrames(2, 450);
  return (
    <View className={cn('bg-accent overflow-hidden', f === 1 && 'opacity-70', className)} {...props}>
      <PixelTexture source={PX.shelfShadow} opacity={0.35} />
    </View>
  );
}

export { Skeleton };
