import { Stack } from 'expo-router';
import { AppProvider } from '../storage/AppProvider';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

function RootNavigator() {
  const { theme } = useTheme();
  return <Stack screenOptions={{ headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.primary, contentStyle: { backgroundColor: theme.background } }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="book/new" options={{ title: '添加小说' }} />
    <Stack.Screen name="book/[id]" options={{ title: '小说详情' }} />
    <Stack.Screen name="book/[id]/edit" options={{ title: '编辑小说' }} />
    <Stack.Screen name="book/[id]/reading/[sessionId]" options={{ title: '阅读日期' }} />
    <Stack.Screen name="settings/tags" options={{ title: '快捷标签设置' }} />
    <Stack.Screen name="settings/backup" options={{ title: '备份与恢复' }} />
    <Stack.Screen name="settings/export" options={{ title: '导出开放格式' }} />
    <Stack.Screen name="settings/data" options={{ title: '数据管理' }} />
    <Stack.Screen name="settings/import" options={{ title: '追加旧记录' }} />
    <Stack.Screen name="settings/overview" options={{ title: '书库概览' }} />
    <Stack.Screen name="settings/annual-recap" options={{ title: '年度阅读回顾' }} />
    <Stack.Screen name="settings/themed-recap" options={{ title: '主题回顾卡片' }} />
    <Stack.Screen name="settings/recap-share" options={{ title: '回顾图片预览' }} />
  </Stack>;
}

export default function RootLayout() {
  return <ThemeProvider><AppProvider><RootNavigator /></AppProvider></ThemeProvider>;
}
