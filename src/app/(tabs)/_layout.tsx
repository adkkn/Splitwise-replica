import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';

import { useColors } from '@/lib/theme';

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        headerShadowVisible: false,
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Friends', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="groups"
        options={{ title: 'Groups', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: 'Activity', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size} color={color as string} /> }}
      />
    </Tabs>
  );
}
