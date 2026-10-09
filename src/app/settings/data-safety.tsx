import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export default function DataSafetyPage() {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>使用与数据安全</Text>
    <Text style={[styles.intro, { color: theme.mutedText }]}>记录属于你。开始长期使用前，请了解它们保存在哪里，以及换版本时怎样带走。</Text>

    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.section, { color: theme.text }]}>记录存在哪里</Text>
      <Text style={[styles.body, { color: theme.text }]}>小说、阅读历史、摘记和图片等记录保存在当前设备的应用数据中。清除应用数据或卸载应用，可能让尚未导出的记录无法找回。</Text>
    </View>

    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.section, { color: theme.text }]}>怎样留下可用的备份</Text>
      <Text style={[styles.body, { color: theme.text }]}>进入“备份与恢复”，生成 .noveltracker 文件，再在系统分享界面保存到“文件”或其他设备外部的安全位置。分享完成后，确认能够在“文件”中找到这份备份。页面显示“已生成”只代表文件生成，不代表你已完成保存。</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings/backup')} style={[styles.button, { backgroundColor: theme.primary }]}>
        <Text style={[styles.buttonText, { color: theme.card }]}>前往备份与恢复</Text>
      </Pressable>
    </View>

    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.section, { color: theme.text }]}>从 Expo Go 迁移</Text>
      <Text style={[styles.body, { color: theme.text }]}>Expo Go 和独立安装版不会自动共享书库。请先在旧版本生成并保存备份文件，再在独立安装版的“备份与恢复”中选择该文件。</Text>
      <Text style={[styles.body, { color: theme.text }]}>恢复会完整替换当前书库。如果独立安装版里已经有记录，请先备份独立安装版里已有的记录，再决定是否恢复旧备份。恢复结束后，请核对小说、阅读历史、摘记和图片；确认之前不要清除 Expo Go 中的原记录。</Text>
    </View>

    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.section, { color: theme.text }]}>分享前留意隐私</Text>
      <Text style={[styles.body, { color: theme.text }]}>备份可能包含私人感想和截图。请妥善保管文件，不要把它公开分享；需要公开展示时，可改用单独制作的回顾图片，并先检查内容。</Text>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, paddingBottom: 40, gap: 14 },
  heading: { fontSize: 26, fontWeight: '800', marginTop: 6 },
  intro: { fontSize: 15, lineHeight: 23, marginBottom: 2 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 12 },
  section: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 24 },
  button: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
