import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TableSheet } from './tableImportTypes';
import { useTheme } from '../theme/ThemeProvider';
import { UI_LAYOUT } from '../ui/layout';

export function TableImportSource({ sheets, fileName, onSelect, onCancel }: {
  sheets: TableSheet[]; fileName: string; onSelect: (index: number) => void; onCancel: () => void;
}) {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>选择工作表</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>{fileName} 已读取。请选择要导入的工作表；每个工作表会单独进入列对应。</Text>
    <View style={styles.list}>{sheets.map((sheet, index) => <Pressable key={`${sheet.name}-${index}`} accessibilityRole="button" onPress={() => onSelect(index)} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.name, { color: theme.text }]}>{sheet.name}</Text><Text style={[styles.meta, { color: theme.mutedText }]}>{sheet.rows.length} 行 · 最多 {Math.max(...sheet.rows.map(row => row.length), 0)} 列</Text>
    </Pressable>)}</View>
    <Pressable accessibilityRole="button" onPress={onCancel} style={styles.link}><Text style={[styles.linkText, { color: theme.primary }]}>返回文件选择</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: UI_LAYOUT.pageInset, gap: 14, paddingBottom: 100 }, heading: { fontSize: 25, fontWeight: '700' }, help: { lineHeight: 21 }, list: { gap: 10 }, card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: UI_LAYOUT.groupRadius, padding: 16, gap: 5, minHeight: UI_LAYOUT.rowMinHeight }, name: { fontSize: 17, fontWeight: '700' }, meta: {}, link: { alignItems: 'center', padding: 10 }, linkText: { fontWeight: '600' },
});
