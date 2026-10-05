import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { BOOK_STATUSES, type BookStatus } from './types';
import { BOOK_STATUS_LABELS } from './status';
import type { BookshelfSheet } from './BookshelfToolsSheet';

export type BookshelfToolbarProps = {
  status: BookStatus | null;
  statusCounts: { all: number } & Record<BookStatus, number>;
  onStatusChange(status: BookStatus | null): void;
  query: string;
  onQueryChange(query: string): void;
  sortLabel: string;
  activeSheet: BookshelfSheet;
  onOpenSheet(sheet: Exclude<BookshelfSheet, null>): void;
  activeFilterCount: number;
  onClearQuery(): void;
};

export function BookshelfToolbar({ status, statusCounts, onStatusChange, query, onQueryChange, sortLabel, activeSheet, onOpenSheet, activeFilterCount, onClearQuery }: BookshelfToolbarProps) {
  const { theme } = useTheme();
  const statuses: { value: BookStatus | null; label: string; count: number }[] = [
    { value: null, label: '全部', count: statusCounts.all },
    ...BOOK_STATUSES.map(value => ({ value, label: BOOK_STATUS_LABELS[value], count: statusCounts[value] })),
  ];
  return <View>
    <ScrollView testID="status-strip" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusStrip}>
      {statuses.map(item => {
        const selected = status === item.value;
        return <Pressable key={item.value ?? 'all'} accessibilityRole="radio" accessibilityLabel={`${item.label} ${item.count} 本`} accessibilityState={{ checked: selected }} onPress={() => onStatusChange(item.value)} style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.border }]}>
          <Text style={{ color: selected ? theme.card : theme.text, fontWeight: selected ? '700' : '500' }}>{item.label}</Text>
          <Text style={{ color: selected ? theme.card : theme.mutedText, fontSize: 12, marginTop: 2 }}>{item.count} 本</Text>
        </Pressable>;
      })}
    </ScrollView>
    <View style={styles.searchRow}><TextInput accessibilityLabel="搜索小说" placeholder="搜索书名、作者、主角、摘记或图片文字" placeholderTextColor={theme.mutedText} value={query} onChangeText={onQueryChange} style={[styles.search, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="清除搜索" onPress={onClearQuery} style={styles.clearQuery}><Text style={[styles.clearQueryText, { color: theme.primary }]}>×</Text></Pressable> : null}</View>
    <View style={styles.toolRow}>
      <Pressable accessibilityRole="button" onPress={() => onOpenSheet('sort')} style={[styles.toolButton, activeSheet === 'sort' && styles.activeTool, { borderColor: theme.border, backgroundColor: activeSheet === 'sort' ? theme.primary : theme.card }]}><Text style={{ color: activeSheet === 'sort' ? theme.card : theme.primary, fontWeight: '700' }}>排序：{sortLabel}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => onOpenSheet('filter')} style={[styles.toolButton, activeSheet === 'filter' && styles.activeTool, { borderColor: theme.border, backgroundColor: activeSheet === 'filter' ? theme.primary : theme.card }]}><Text style={{ color: activeSheet === 'filter' ? theme.card : theme.primary, fontWeight: '700' }}>筛选{activeFilterCount ? `（${activeFilterCount}）` : ''}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => onOpenSheet('more')} style={[styles.toolButton, activeSheet === 'more' && styles.activeTool, { borderColor: theme.border, backgroundColor: activeSheet === 'more' ? theme.primary : theme.card }]}><Text style={{ color: activeSheet === 'more' ? theme.card : theme.primary, fontWeight: '700' }}>更多</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  statusStrip: { gap: 8, paddingVertical: 12 }, chip: { minWidth: 74, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' }, searchRow: { position: 'relative' }, search: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, paddingRight: 42, fontSize: 16 }, clearQuery: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }, clearQueryText: { fontSize: 26, lineHeight: 28 }, toolRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }, toolButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }, activeTool: { borderWidth: 2 },
});
