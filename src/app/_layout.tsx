import { Stack } from 'expo-router';
import { AppProvider } from '../storage/AppProvider';

export default function RootLayout() {
  return <AppProvider><Stack screenOptions={{ headerStyle: { backgroundColor: '#f8f5ef' }, contentStyle: { backgroundColor: '#f8f5ef' } }}>
    <Stack.Screen name="index" options={{ title: '我的书架' }} />
    <Stack.Screen name="book/new" options={{ title: '添加小说' }} />
    <Stack.Screen name="book/[id]" options={{ title: '小说详情' }} />
    <Stack.Screen name="book/[id]/edit" options={{ title: '编辑小说' }} />
    <Stack.Screen name="book/[id]/reading/[sessionId]" options={{ title: '阅读日期' }} />
    <Stack.Screen name="settings/tags" options={{ title: '快捷标签设置' }} />
    <Stack.Screen name="settings/backup" options={{ title: '备份与恢复' }} />
    <Stack.Screen name="settings/data" options={{ title: '数据管理' }} />
    <Stack.Screen name="settings/import" options={{ title: '追加旧记录' }} />
  </Stack></AppProvider>;
}
