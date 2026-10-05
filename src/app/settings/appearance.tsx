import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { ThemePicker } from '../../theme/ThemePicker';
import { useTheme } from '../../theme/ThemeProvider';

export default function AppearancePage() {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>外观</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>选择喜欢的主题颜色，立即预览并保存在当前设备。</Text>
    <ThemePicker />
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.back, { borderColor: theme.primary }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>返回管理</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({ container: { flexGrow: 1, padding: 22, gap: 14, paddingBottom: 36 }, heading: { fontSize: 28, fontWeight: '800', marginTop: 10 }, help: { lineHeight: 21 }, back: { borderWidth: 1, borderRadius: 12, padding: 15, alignItems: 'center' } });
