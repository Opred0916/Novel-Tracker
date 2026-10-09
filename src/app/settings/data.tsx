import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { GroupedSection } from '../../ui/GroupedSection';
import { ActionRow } from '../../ui/ActionRow';
import { UI_LAYOUT } from '../../ui/layout';

export default function DataManagementPage() {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={[styles.heading, { color: theme.text }]}>数据管理</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>追加旧记录只会新增或追加预览中确认的内容；备份恢复则是整库替换，两者互不混用。</Text>
    <GroupedSection title="书库文件">
      <ActionRow label="追加旧记录" detail="只写入预览中确认的内容" onPress={() => router.push('/settings/import')} />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <ActionRow label="导出开放格式" detail="生成 JSON、CSV 和图片副本" onPress={() => router.push('/settings/export')} />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <ActionRow label="备份与恢复" detail="生成备份或完整替换书库" onPress={() => router.push('/settings/backup')} />
    </GroupedSection>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: UI_LAYOUT.pageInset, gap: UI_LAYOUT.sectionGap, paddingBottom: 50 }, heading: { fontSize: 26, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 }, divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
