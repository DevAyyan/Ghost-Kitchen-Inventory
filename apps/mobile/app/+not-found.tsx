import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { Ghost } from 'lucide-react-native';
import { View } from 'react-native';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <View className="bg-background flex-1 justify-center p-6">
      <EmptyState
        icon={Ghost}
        title="Nothing haunts this page"
        description="The page you were looking for doesn't exist."
        action={
          <Button onPress={() => router.replace('/')}>
            <Text>Back to the fridge</Text>
          </Button>
        }
      />
    </View>
  );
}
