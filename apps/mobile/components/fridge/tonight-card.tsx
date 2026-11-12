import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { api, isApiConfigured, type TonightIdea } from '@/lib/api';
import { daysLeft, isAtRisk, isCookable, stageOf } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { useSettings } from '@/lib/store/settings-store';
import { useRouter } from 'expo-router';
import { ChefHat } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** Ideas already fetched this session, keyed by day + items + diets, so re-renders cost nothing. */
const cache = new Map<string, TonightIdea>();

/** The one thing to do tonight with what is about to turn. Hidden when nothing is at risk. */
export function TonightCard({ items }: { items: Item[] }) {
  const router = useRouter();
  const diets = useSettings((s) => s.settings.diets);
  const useAi = useSettings((s) => !s.settings.tesseractOnly);

  const urgent = React.useMemo(
    () => items.filter((i) => isAtRisk(stageOf(i)) && isCookable(i)).sort((a, b) => a.expires.localeCompare(b.expires)).slice(0, 8),
    [items]
  );
  const key = `${new Date().toDateString()}|${urgent.map((i) => `${i.name}:${daysLeft(i)}`).join(',')}|${diets.join(',')}|${useAi}`;
  const [idea, setIdea] = React.useState<TonightIdea | null>(() => cache.get(key) ?? null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (urgent.length === 0) return;
    const hit = cache.get(key);
    if (hit) { setIdea(hit); return; }
    setIdea(null);
    if (!isApiConfigured()) return;
    let live = true;
    setLoading(true);
    api
      .tonight({ items: urgent.map((i) => ({ name: i.name, daysLeft: daysLeft(i), highRisk: i.highRisk })), diets, useAi })
      .then((r) => { cache.set(key, r); if (live) setIdea(r); })
      .catch(() => {})
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [key, urgent, diets, useAi]);

  if (urgent.length === 0) return null;
  const names = urgent.slice(0, 3).map((i) => i.name);

  return (
    <View role="region" aria-label="Cook this tonight" className="border-primary/40 bg-card gap-2 rounded-lg border p-4">
      <View className="flex-row items-center gap-2">
        <Icon as={ChefHat} size={18} className="text-primary" />
        <Text role="heading" aria-level={2} className="font-semibold">Cook this tonight</Text>
      </View>
      {loading ? (
        <View aria-busy aria-label="Thinking of something to cook" className="gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </View>
      ) : idea ? (
        <>
          <Text className="text-base font-semibold">{idea.title}</Text>
          <Text className="text-muted-foreground text-sm">{idea.pitch}</Text>
          {idea.uses.length > 0 && <Text className="text-sm">Uses: {idea.uses.join(', ')}</Text>}
        </>
      ) : (
        <Text className="text-muted-foreground text-sm">
          {names.join(', ')} {urgent.length > 3 ? `and ${urgent.length - 3} more ` : ''}need cooking soon.
        </Text>
      )}
      <View className="flex-row flex-wrap gap-2 pt-1">
        <Button className="h-11" onPress={() => router.navigate({ pathname: '/recipes', params: { summon: '1' } })}>
          <Text>Find recipes</Text>
        </Button>
      </View>
    </View>
  );
}
