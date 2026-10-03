import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TableSheet } from './tableImportTypes';

export function TableImportSource({ sheets, fileName, onSelect, onCancel }: {
  sheets: TableSheet[]; fileName: string; onSelect: (index: number) => void; onCancel: () => void;
}) {
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.heading}>选择工作表</Text>
    <Text style={styles.help}>{fileName} 已读取。请选择要导入的工作表；每个工作表会单独进入列对应。</Text>
    <View style={styles.list}>{sheets.map((sheet, index) => <Pressable key={`${sheet.name}-${index}`} accessibilityRole="button" onPress={() => onSelect(index)} style={styles.card}>
      <Text style={styles.name}>{sheet.name}</Text><Text style={styles.meta}>{sheet.rows.length} 行 · 最多 {Math.max(...sheet.rows.map(row => row.length), 0)} 列</Text>
    </Pressable>)}</View>
    <Pressable accessibilityRole="button" onPress={onCancel} style={styles.link}><Text style={styles.linkText}>返回文件选择</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14, paddingBottom: 50 }, heading: { fontSize: 25, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 }, list: { gap: 10 }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, padding: 16, gap: 5 }, name: { color: '#302a25', fontSize: 17, fontWeight: '700' }, meta: { color: '#817871' }, link: { alignItems: 'center', padding: 10 }, linkText: { color: '#593f72', fontWeight: '600' },
});
