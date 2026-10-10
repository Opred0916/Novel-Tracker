import { Stack } from 'expo-router';
import { AppProvider } from '../storage/AppProvider';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { AccountProvider, useAccount } from '../account/AccountProvider';
import { SyncProvider } from '../sync/SyncProvider';

function RootNavigator() {
  const { theme } = useTheme();
  return <Stack screenOptions={{ headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.primary, headerTitleStyle: { color: theme.text, fontWeight: '600' }, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: theme.background } }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="book/new" options={{ title: '添加小说', headerBackTitle: '书架' }} />
    <Stack.Screen name="book/[id]" options={{ title: '小说详情', headerBackTitle: '书架' }} />
    <Stack.Screen name="book/[id]/edit" options={{ title: '编辑小说', headerBackTitle: '小说详情' }} />
    <Stack.Screen name="book/[id]/reading/[sessionId]" options={{ title: '阅读日期', headerTitle: '', headerBackTitle: '小说详情' }} />
    <Stack.Screen name="settings/tags" options={{ title: '快捷标签设置', headerTitle: '', headerBackTitle: '管理' }} />
    <Stack.Screen name="settings/backup" options={{ title: '备份与恢复', headerTitle: '', headerBackTitle: '管理' }} />
    <Stack.Screen name="settings/data-safety" options={{ title: '使用与数据安全', headerTitle: '', headerBackTitle: '管理' }} />
    <Stack.Screen name="settings/export" options={{ title: '导出开放格式', headerTitle: '', headerBackTitle: '管理' }} />
    <Stack.Screen name="settings/import" options={{ title: '追加旧记录', headerTitle: '', headerBackTitle: '管理' }} />
    <Stack.Screen name="settings/overview" options={{ title: '书库概览', headerTitle: '', headerBackTitle: '管理', headerBackButtonDisplayMode: 'default' }} />
    <Stack.Screen name="settings/appearance" options={{ title: '外观', headerTitle: '', headerBackTitle: '管理' }} />
    <Stack.Screen name="settings/account" options={{ title: '账号与同步', headerTitle: '', headerBackTitle: '管理' }} />
    <Stack.Screen name="settings/sync-conflicts" options={{ title: '处理同步冲突', headerTitle: '', headerBackTitle: '账号与同步' }} />
    <Stack.Screen name="settings/annual-recap" options={{ title: '阅读记录', headerTitle: '' }} />
    <Stack.Screen name="settings/annual-summary" options={{ headerShown: false }} />
  </Stack>;
}

function AccountLibrary() {
  const { user } = useAccount();
  return <AppProvider key={user?.id ?? 'guest'} accountId={user?.id}><SyncProvider><RootNavigator /></SyncProvider></AppProvider>;
}

export default function RootLayout() {
  return <ThemeProvider><AccountProvider><AccountLibrary /></AccountProvider></ThemeProvider>;
}
