import { EmptyState } from '@/components/common/empty-state';
import { Screen } from '@/components/common/screen';
import { GraveyardScene } from '@/components/graveyard/graveyard-scene';
import { Text } from '@/components/ui/text';
import { useSummarize } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { Sprout } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

export default function GraveyardScreen() {
  const graves = useApp(useShallow((s) => s.events.filter((e) => e.type === 'discarded')));
  const summarize = useSummarize();
  const lost = summarize(graves);

  return (
    <Screen display title="The graveyard" description={`${graves.length} buried · ${lost.text} lost. Every grave is a recipe that could have been.`}>
      {graves.length === 0 ? (
        <EmptyState icon={Sprout} art="headstone" title="No graves yet" description="Everything has been eaten in time." />
      ) : (
        <>
          <Text className="text-muted-foreground text-sm">The bigger the stone, the more that food cost you.</Text>
          <GraveyardScene graves={graves} />
        </>
      )}
    </Screen>
  );
}
