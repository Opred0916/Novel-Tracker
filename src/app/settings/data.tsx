import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export default function DataManagementPage() {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={[styles.heading, { color: theme.text }]}>数据管理</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>追加旧记录只会新增或追加预览中确认的内容；备份恢复则是整库替换，两者互不混用。</Text>
    <Pressable accessibilityRole="button" onPress={() => router.push('/settings/import')} style={[styles.primary, { backgroundColor: theme.primary }]}><Text style={styles.primaryText}>追加旧记录</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.push('/settings/export')} style={[styles.secondary, { backgroundColor: theme.card, borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>导出开放格式</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.push('/settings/backup')} style={[styles.secondary, { backgroundColor: theme.card, borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>备份与恢复</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, paddingBottom: 50 }, heading: { fontSize: 26, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 }, primary: { backgroundColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center' }, secondaryText: { color: '#28584E', fontWeight: '700' },
});
