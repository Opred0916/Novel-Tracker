import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TableSheet } from './tableImportTypes';
import { useTheme } from '../theme/ThemeProvider';

export function TableImportSource({ sheets, fileName, onSelect, onCancel }: {
  sheets: TableSheet[]; fileName: string; onSelect: (index: number) => void; onCancel: () => void;
}) {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={[styles.heading, { color: theme.text }]}>选择工作表</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>{fileName} 已读取。请选择要导入的工作表；每个工作表会单独进入列对应。</Text>
    <View style={styles.list}>{sheets.map((sheet, index) => <Pressable key={`${sheet.name}-${index}`} accessibilityRole="button" onPress={() => onSelect(index)} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.name, { color: theme.text }]}>{sheet.name}</Text><Text style={[styles.meta, { color: theme.mutedText }]}>{sheet.rows.length} 行 · 最多 {Math.max(...sheet.rows.map(row => row.length), 0)} 列</Text>
    </Pressable>)}</View>
    <Pressable accessibilityRole="button" onPress={onCancel} style={styles.link}><Text style={[styles.linkText, { color: theme.primary }]}>返回文件选择</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14, paddingBottom: 50 }, heading: { fontSize: 25, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 }, list: { gap: 10 }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, padding: 16, gap: 5 }, name: { color: '#302a25', fontSize: 17, fontWeight: '700' }, meta: { color: '#817871' }, link: { alignItems: 'center', padding: 10 }, linkText: { color: '#28584E', fontWeight: '600' },
});
