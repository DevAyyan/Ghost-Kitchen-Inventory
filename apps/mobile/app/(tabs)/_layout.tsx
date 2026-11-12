import { AppTabBar } from '@/components/shell/tab-bar';
import { TopBar } from '@/components/shell/top-bar';
import { useLayout } from '@/lib/hooks';
import { COLORS } from '@/lib/theme';
import { Tabs } from 'expo-router/tabs';
import { View } from 'react-native';

export default function TabsLayout() {
  const { isPhone } = useLayout();
  return (
    <View className="bg-background flex-1">
      <TopBar />
      <Tabs
        tabBar={(props) => <AppTabBar {...props} />}
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarPosition: isPhone ? 'bottom' : 'left',
          sceneStyle: { backgroundColor: COLORS.background },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Fridge' }} />
        <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
        <Tabs.Screen name="recipes" options={{ title: 'Recipes' }} />
        <Tabs.Screen name="plan" options={{ title: 'Plan & shop' }} />
        <Tabs.Screen name="ledger" options={{ title: 'Ledger' }} />
        <Tabs.Screen name="graveyard" options={{ title: 'Graveyard' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
    </View>
  );
}
