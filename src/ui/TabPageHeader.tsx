import React, { useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { UI_LAYOUT } from './layout';

export function TabPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  return <View testID="tab-page-header" style={[styles.container, { paddingTop: (insets?.top ?? 0) + 12 }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
    {subtitle ? <Text style={[styles.subtitle, { color: theme.mutedText }]}>{subtitle}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: UI_LAYOUT.pageInset, paddingBottom: 16, gap: 4 },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20 },
});
