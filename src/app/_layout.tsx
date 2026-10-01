import { Stack } from 'expo-router';
import { AppProvider } from '../storage/AppProvider';

export default function RootLayout() {
  return <AppProvider><Stack screenOptions={{ headerStyle: { backgroundColor: '#f8f5ef' }, contentStyle: { backgroundColor: '#f8f5ef' } }}>
    <Stack.Screen name="index" options={{ title: '我的书架' }} />
    <Stack.Screen name="book/new" options={{ title: '添加小说' }} />
  </Stack></AppProvider>;
}
