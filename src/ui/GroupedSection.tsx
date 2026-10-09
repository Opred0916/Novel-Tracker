import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { UI_LAYOUT } from './layout';

export function GroupedSection({ title, children }: PropsWithChildren<{ title?: string }>) {
  const { theme } = useTheme();
  return <View style={styles.section}>
    {title ? <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{title}</Text> : null}
    <View style={[styles.surface, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { fontSize: 16, fontWeight: '700', marginHorizontal: 4 },
  surface: { borderWidth: StyleSheet.hairlineWidth, borderRadius: UI_LAYOUT.groupRadius, overflow: 'hidden' },
});
