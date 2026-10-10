import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { UI_LAYOUT } from '../../ui/layout';

export default function DataSafetyPage() {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>使用与数据安全</Text>
    <Text style={[styles.intro, { color: theme.mutedText }]}>先确认保存位置，再为换机留一份备份。</Text>

    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.section, { color: theme.text }]}>① 记录存在哪里</Text>
      <Text style={[styles.body, { color: theme.text }]}>未登录：书库只在当前设备。</Text>
      <Text style={[styles.body, { color: theme.text }]}>已登录：账号书库和图片保存在本机，并同步到配置的云服务。</Text>
      <Text style={[styles.note, { color: theme.mutedText }]}>两种书库不会自动合并；未同步的修改不要靠卸载后找回。</Text>
    </View>

    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.section, { color: theme.text }]}>② 留下可用的备份</Text>
      <Text style={[styles.body, { color: theme.text }]}>生成 .noveltracker 文件 → 保存到“文件”或其他设备外 → 确认能找到它。</Text>
      <Text style={[styles.note, { color: theme.mutedText }]}>“已生成”不等于已保存。</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings/backup')} style={[styles.button, { backgroundColor: theme.primary }]}>
        <Text style={[styles.buttonText, { color: theme.card }]}>前往备份与恢复</Text>
      </Pressable>
    </View>

    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.section, { color: theme.text }]}>③ 换到独立安装版</Text>
      <Text style={[styles.body, { color: theme.text }]}>Expo Go 与独立安装版不共享书库：先备份旧版，再到新版恢复。</Text>
      <Text style={[styles.note, { color: theme.mutedText }]}>恢复会替换新版当前书库。若新版已有记录，先备份；恢复后核对小说、阅读历史、摘记和图片，再清除旧版数据。</Text>
    </View>

    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.section, { color: theme.text }]}>隐私提醒</Text>
      <Text style={[styles.body, { color: theme.text }]}>备份可能含私人感想和截图。请存放在安全位置，不要公开分享。</Text>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: UI_LAYOUT.pageInset, paddingBottom: 100, gap: UI_LAYOUT.sectionGap },
  heading: { fontSize: 26, fontWeight: '800', marginTop: 6 },
  intro: { fontSize: 15, lineHeight: 23, marginBottom: 2 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: UI_LAYOUT.groupRadius, padding: 16, gap: 8 },
  section: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23 },
  note: { fontSize: 14, lineHeight: 21 },
  button: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
