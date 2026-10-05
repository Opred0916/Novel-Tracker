import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function BulkSelectionBar({ selectedCount, canSelectAll, onCancel, onSelectAll, onContinue }: { selectedCount: number; canSelectAll: boolean; onCancel(): void; onSelectAll(): void; onContinue(): void }) {
  const { theme } = useTheme();
  return <View style={styles.wrap}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8}><Text style={[styles.actionText, { color: theme.primary }]}>取消</Text></Pressable>
      <Text style={[styles.count, { color: theme.text }]}>已选 {selectedCount} 本</Text>
      <Pressable accessibilityRole="button" disabled={!canSelectAll} accessibilityState={{ disabled: !canSelectAll }} onPress={onSelectAll} hitSlop={8}><Text style={[styles.actionText, { color: canSelectAll ? theme.primary : theme.mutedText }]}>全选当前结果</Text></Pressable>
    </View>
    <Pressable testID="bulk-continue" accessibilityRole="button" disabled={selectedCount === 0} accessibilityState={{ disabled: selectedCount === 0 }} onPress={onContinue} style={[styles.continue, { backgroundColor: selectedCount ? theme.primary : theme.primarySoft }]}><Text style={{ color: selectedCount ? theme.card : theme.mutedText, fontWeight: '700' }}>整理所选</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 10 }, header: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, count: { flex: 1, textAlign: 'center', fontWeight: '700' }, actionText: { fontWeight: '700' }, continue: { alignItems: 'center', borderRadius: 14, paddingVertical: 13 },
});
