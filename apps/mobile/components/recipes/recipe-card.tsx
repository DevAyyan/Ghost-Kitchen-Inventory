import { StepIn } from '@/components/common/pixel-motion';
import { FoodPhoto } from '@/components/food/food-photo';
import { STAGE_STYLE } from '@/components/stage/stage-style';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import type { RemoteRecipe } from '@/lib/api';
import { stageOf } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { useLayout } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { CalendarPlus, Check, ChefHat, ChevronDown, ChevronUp, ExternalLink, Globe, ShoppingBasket } from 'lucide-react-native';
import * as React from 'react';
import { Image, Linking, Pressable, View } from 'react-native';

interface RecipeCardProps {
  recipe: RemoteRecipe;
  /** Fridge items by id, to show what this recipe rescues. */
  items: Map<string, Item>;
  saves: string;
  onCook: () => void;
  onPlan: () => void;
  defaultOpen: boolean;
}

export function RecipeCard({ recipe, items, saves, onCook, onPlan, defaultOpen, index = 0 }: RecipeCardProps & { index?: number }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const { isPhone } = useLayout();
  const rescued = recipe.rescuesItemIds.map((id) => items.get(id)).filter((i): i is Item => !!i);
  const origin = [recipe.area, recipe.category].filter(Boolean).join(' · ');

  return (
    // flex-1 only side by side: in a phone's column, Android gives a flex-1 card zero height to start
    // from, and overflow-hidden then cuts off the photo and the steps. The step-in carries the sizing,
    // so the card inside it is simply full width. `index` deals a list of cards in one by one.
    <StepIn index={index} className={isPhone ? 'w-full' : 'min-w-72 flex-1'}>
    <Card className="w-full gap-4 overflow-hidden pb-4 pt-0">
      {recipe.thumb ? (
        <Image source={{ uri: recipe.thumb }} accessibilityIgnoresInvertColors alt="" aria-hidden className="bg-muted w-full" style={{ aspectRatio: 16 / 9 }} resizeMode="cover" />
      ) : (
        <View className="bg-muted aspect-video w-full items-center justify-center"><Icon as={ChefHat} size={32} className="text-muted-foreground" /></View>
      )}
      <CardHeader className="gap-2 px-4">
        <CardTitle role="heading" aria-level={2} className="text-lg">{recipe.title}</CardTitle>
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          {origin ? <Meta icon={Globe} text={origin} /> : null}
          <Meta icon={ShoppingBasket} text={recipe.missing.length ? `${recipe.missing.length} to buy` : 'All in your kitchen'} />
        </View>
      </CardHeader>

      <CardContent className="gap-3 px-4">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Text className="text-muted-foreground text-xs">Rescues</Text>
          {rescued.map((i) => {
            const s = STAGE_STYLE[stageOf(i)];
            return (
              <View key={i.id} accessibilityLabel={`${i.name}, ${s.label}`} className={cn('flex-row items-center gap-1 rounded-sm border px-2 py-0.5', s.border)}>
                <FoodPhoto photoUri={i.photoUri} category={i.category} name={i.name} size="xs" />
                <Text className="text-xs">{i.name}</Text>
                <Icon as={s.icon} size={11} className={s.text} />
              </View>
            );
          })}
        </View>

        <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} className="min-h-11 flex-row items-center gap-1">
          <Text className="text-primary text-sm font-medium">Ingredients & steps</Text>
          <Icon as={open ? ChevronUp : ChevronDown} size={16} className="text-primary" />
        </Pressable>
        {open && (
          <View className="gap-3">
            <View role="list" className="gap-1">
              {recipe.ingredients.map((ing, idx) => (
                <View key={`${ing.name}-${idx}`} role="listitem" className="flex-row items-start gap-2">
                  <Icon as={ing.inStock ? Check : ShoppingBasket} size={14} className={cn('mt-0.5', ing.inStock ? 'text-stage-fresh' : 'text-warning')} />
                  <Text className={cn('flex-1 text-sm', !ing.inStock && 'text-warning')}>
                    {ing.measure ? <Text className="text-muted-foreground text-sm">{ing.measure} </Text> : null}
                    {ing.name}
                    <Text className="text-muted-foreground text-xs">{ing.staple ? ' · pantry staple' : ing.inStock ? ' · in your kitchen' : ' · need to buy'}</Text>
                  </Text>
                </View>
              ))}
            </View>
            <View role="list" className="gap-1.5">
              {recipe.steps.map((s, idx) => (
                <View key={idx} role="listitem" className="flex-row gap-2">
                  <Text className="text-muted-foreground w-6 text-sm tabular-nums">{idx + 1}.</Text>
                  <Text className="flex-1 text-sm">{s}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Button variant="ghost" size="sm" className="h-11" onPress={() => void Linking.openURL(recipe.sourceUrl)}>
                <Icon as={ExternalLink} size={14} /><Text>View on TheMealDB</Text>
              </Button>
              {recipe.youtube ? (
                <Button variant="ghost" size="sm" className="h-11" onPress={() => void Linking.openURL(recipe.youtube!)}>
                  <Icon as={ExternalLink} size={14} /><Text>Video</Text>
                </Button>
              ) : null}
            </View>
          </View>
        )}
      </CardContent>

      <CardFooter className="border-border mt-auto flex-row items-center justify-between gap-2 border-t px-4 pt-3">
        <View>
          <Text className="text-muted-foreground text-xs">Saves about</Text>
          <Text className="text-stage-fresh font-semibold tabular-nums">{saves}</Text>
        </View>
        <View className="flex-row flex-wrap justify-end gap-2">
          <Button variant="outline" className="h-11" onPress={onPlan} accessibilityLabel={`Plan ${recipe.title} for a day`}>
            <Icon as={CalendarPlus} size={16} />
            <Text>Plan</Text>
          </Button>
          <Button className="h-11" onPress={onCook}>
            <Icon as={ChefHat} size={16} className="text-primary-foreground" />
            <Text>Cook this</Text>
          </Button>
        </View>
      </CardFooter>
    </Card>
    </StepIn>
  );
}

function Meta({ icon, text }: { icon: typeof Globe; text: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Icon as={icon} size={13} className="text-muted-foreground" />
      <Text className="text-muted-foreground text-xs">{text}</Text>
    </View>
  );
}

export function RecipeCardSkeleton() {
  const { isPhone } = useLayout();
  return (
    <Card className={cn('gap-3 overflow-hidden pt-0', isPhone ? 'w-full' : 'min-w-72 flex-1')}>
      <Skeleton className="aspect-video w-full rounded-none" />
      <View className="gap-3 px-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-11 w-32 self-end" />
      </View>
    </Card>
  );
}
