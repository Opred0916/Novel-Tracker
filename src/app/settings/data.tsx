import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export default function DataManagementPage() {
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.heading}>数据管理</Text>
    <Text style={styles.help}>追加旧记录只会新增或追加预览中确认的内容；备份恢复则是整库替换，两者互不混用。</Text>
    <Pressable accessibilityRole="button" onPress={() => router.push('/settings/import')} style={styles.primary}><Text style={styles.primaryText}>追加旧记录</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.push('/settings/export')} style={styles.secondary}><Text style={styles.secondaryText}>导出开放格式</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.push('/settings/backup')} style={styles.secondary}><Text style={styles.secondaryText}>备份与恢复</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, paddingBottom: 50 }, heading: { fontSize: 26, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 }, primary: { backgroundColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' }, secondaryText: { color: '#593f72', fontWeight: '700' },
});
