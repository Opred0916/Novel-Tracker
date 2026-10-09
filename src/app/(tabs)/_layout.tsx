import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';

export default function TabsLayout() {
  const { theme } = useTheme();
  return <Tabs screenOptions={{
    tabBarActiveTintColor: theme.primary,
    tabBarInactiveTintColor: theme.mutedText,
    tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border, borderTopWidth: 0.5 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    headerShown: false,
  }}>
    <Tabs.Screen name="index" options={{ title: '书架', tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="recap" options={{ title: '回顾', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="manage" options={{ title: '管理', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
  </Tabs>;
}
