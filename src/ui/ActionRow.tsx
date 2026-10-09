import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { UI_LAYOUT } from './layout';

export function ActionRow({ label, detail, value, onPress, danger = false }: {
  label: string; detail?: string; value?: string; onPress(): void; danger?: boolean;
}) {
  const { theme } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.primarySoft : theme.card }]}>
    <View style={styles.main}>
      <Text style={[styles.label, { color: danger ? theme.danger : theme.text }]}>{label}</Text>
      {detail ? <Text style={[styles.detail, { color: theme.mutedText }]}>{detail}</Text> : null}
    </View>
    {value ? <Text style={[styles.value, { color: theme.mutedText }]} numberOfLines={1}>{value}</Text> : null}
    <Ionicons name="chevron-forward" size={16} color={theme.mutedText} />
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { minHeight: UI_LAYOUT.rowMinHeight, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  main: { flex: 1, gap: 2 },
  label: { fontSize: 16, fontWeight: '500' },
  detail: { fontSize: 13, lineHeight: 18 },
  value: { maxWidth: '35%', fontSize: 14 },
});
