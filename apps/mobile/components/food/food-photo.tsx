import { Icon } from '@/components/ui/icon';
import type { Category, Stage } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Image, View } from 'react-native';
import { foodIcon } from './food-icon';

export { CATEGORY_ICON } from './food-icon';

const SIZES = {
  xs: { box: 'h-6 w-6 rounded', icon: 12 },
  sm: { box: 'h-10 w-10 rounded-md', icon: 18 },
  md: { box: 'h-14 w-14 rounded-md', icon: 24 },
  lg: { box: 'h-40 w-40 rounded-lg', icon: 48 },
} as const;

interface FoodPhotoProps {
  photoUri?: string;
  category: Category;
  /** The food's name: picks a more specific icon than the category's when there's no photo. */
  name?: string;
  size?: keyof typeof SIZES;
  /** Rotting/spoiled photos get a tint so decay reads at a glance (colour is not the only cue). */
  stage?: Stage;
  className?: string;
  /** Overlays drawn over the photo and clipped to it (decay effects on fridge tiles). */
  children?: React.ReactNode;
}

/** The user's own photo of the food, or a category icon placeholder. Decorative: callers label it. */
export function FoodPhoto({ photoUri, category, name, size = 'md', stage, className, children }: FoodPhotoProps) {
  const s = SIZES[size];
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [photoUri]);
  const showPhoto = !!photoUri && !failed;

  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      className={cn('bg-muted items-center justify-center overflow-hidden', s.box, className)}>
      {showPhoto ? (
        <Image
          source={{ uri: photoUri }}
          onError={() => setFailed(true)}
          resizeMode="cover"
          className={cn('h-full w-full', stage === 'spoiled' && 'opacity-40', stage === 'rotting' && 'opacity-80')}
        />
      ) : (
        <Icon as={foodIcon(category, name)} size={s.icon} className={cn('text-muted-foreground', stage === 'spoiled' && 'opacity-50')} />
      )}
      {showPhoto && stage === 'rotting' && <View className="bg-stage-rotting/30 absolute inset-0" />}
      {showPhoto && stage === 'spoiled' && <View className="bg-stage-spoiled/30 absolute inset-0" />}
      {children}
    </View>
  );
}
