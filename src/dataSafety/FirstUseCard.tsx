import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function FirstUseCard({ onDismiss, onLearnMore }: { onDismiss(): void; onLearnMore(): void }) {
  const { theme } = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
    <Text style={[styles.title, { color: theme.text }]}>记录从这里开始</Text>
    <Text style={[styles.body, { color: theme.mutedText }]}>书库记录保存在这台设备的应用中。开始记录后，记得将完整备份保存到“文件”或你信任的位置。</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.action}><Text style={[styles.actionText, { color: theme.mutedText }]}>明白了</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onLearnMore} style={[styles.action, { backgroundColor: theme.primarySoft }]}><Text style={[styles.actionText, { color: theme.primary }]}>了解备份</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 18, width: '100%', maxWidth: 420, gap: 10 },
  title: { fontSize: 17, fontWeight: '700' },
  body: { lineHeight: 22 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  action: { minHeight: 42, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10 },
  actionText: { fontWeight: '700' },
});
