import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function BackupReminderCard({ onBackup, onDismiss }: { onBackup(): void; onDismiss(): void }) {
  const { theme } = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
    <Text style={[styles.title, { color: theme.text }]}>书库已有记录</Text>
    <Text style={[styles.body, { color: theme.text }]}>建议生成完整备份，并在系统分享界面把文件保存到“文件”等位置。</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.action}><Text style={[styles.label, { color: theme.primary }]}>暂不提醒</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onBackup} style={[styles.action, { backgroundColor: theme.primary }]}><Text style={[styles.label, { color: theme.card }]}>去备份</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  body: { lineHeight: 21 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  action: { minHeight: 42, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10 },
  label: { fontWeight: '700' },
});
