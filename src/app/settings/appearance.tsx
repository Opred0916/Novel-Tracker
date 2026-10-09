import { ScrollView, StyleSheet, Text } from 'react-native';
import { ThemePicker } from '../../theme/ThemePicker';
import { useTheme } from '../../theme/ThemeProvider';
import { UI_LAYOUT } from '../../ui/layout';

export default function AppearancePage() {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>外观</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>选择喜欢的主题颜色，立即预览并保存在当前设备。</Text>
    <ThemePicker />
  </ScrollView>;
}

const styles = StyleSheet.create({ container: { flexGrow: 1, padding: UI_LAYOUT.pageInset, gap: UI_LAYOUT.sectionGap, paddingBottom: 36 }, heading: { fontSize: 28, fontWeight: '800', marginTop: 10 }, help: { lineHeight: 21 } });
