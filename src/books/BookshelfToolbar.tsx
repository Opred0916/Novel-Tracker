import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { BOOK_STATUSES, type BookStatus } from './types';
import { BOOK_STATUS_LABELS } from './status';
import type { BookSortOrder } from './bookSearch';

export type BookshelfToolbarProps = {
  status: BookStatus | null;
  statusCounts: { all: number } & Record<BookStatus, number>;
  onStatusChange(status: BookStatus | null): void;
  query: string;
  onQueryChange(query: string): void;
  sortLabel: string;
  sortOptions: { value: BookSortOrder; label: string }[];
  sortOrder: BookSortOrder;
  showSortOptions: boolean;
  onToggleSort(): void;
  onSortChange(order: BookSortOrder): void;
  activeFilterCount: number;
  hasConditions: boolean;
  onClearFilters(): void;
  onToggleFilters(): void;
  onEnterBulk(): void;
  bulkMode: boolean;
};

export function BookshelfToolbar({ status, statusCounts, onStatusChange, query, onQueryChange, sortLabel, sortOptions, sortOrder, showSortOptions, onToggleSort, onSortChange, activeFilterCount, hasConditions, onClearFilters, onToggleFilters, onEnterBulk, bulkMode }: BookshelfToolbarProps) {
  const { theme } = useTheme();
  const statuses: { value: BookStatus | null; label: string; count: number }[] = [
    { value: null, label: '全部', count: statusCounts.all },
    ...BOOK_STATUSES.map(value => ({ value, label: BOOK_STATUS_LABELS[value], count: statusCounts[value] })),
  ];
  return <View>
    <ScrollView testID="status-strip" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusStrip}>
      {statuses.map(item => {
        const selected = status === item.value;
        return <Pressable key={item.value ?? 'all'} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onStatusChange(item.value)} style={[styles.chip, { backgroundColor: selected ? theme.primarySoft : theme.card, borderColor: selected ? theme.primary : theme.border }]}>
          <Text style={{ color: selected ? theme.primary : theme.text, fontWeight: selected ? '700' : '500' }}>{item.label}</Text>
          <Text style={{ color: selected ? theme.primary : theme.mutedText, fontSize: 12, marginTop: 2 }}>{item.count} 本</Text>
        </Pressable>;
      })}
    </ScrollView>
    <TextInput accessibilityLabel="搜索小说" placeholder="搜索书名、作者、主角、摘记或图片文字" placeholderTextColor={theme.mutedText} value={query} onChangeText={onQueryChange} style={[styles.search, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
    <View style={styles.toolRow}>
      <Pressable accessibilityRole="button" onPress={onToggleSort} style={[styles.toolButton, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>排序：{sortLabel}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onToggleFilters} style={[styles.toolButton, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>筛选条件{activeFilterCount ? `（${activeFilterCount}）` : ''}</Text></Pressable>
      {hasConditions ? <Pressable accessibilityRole="button" onPress={onClearFilters} style={styles.clearButton}><Text style={{ color: theme.primary, fontWeight: '700' }}>清除筛选</Text></Pressable> : null}
      {!bulkMode ? <Pressable accessibilityRole="button" onPress={onEnterBulk} style={styles.textButton}><Text style={{ color: theme.primary, fontWeight: '700' }}>批量整理</Text></Pressable> : null}
    </View>
    {showSortOptions ? <View style={styles.sortOptions}>{sortOptions.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: sortOrder === option.value }} onPress={() => onSortChange(option.value)} style={[styles.sortOption, { backgroundColor: sortOrder === option.value ? theme.primarySoft : theme.card, borderColor: theme.border }]}><Text style={{ color: theme.text }}>{option.label}</Text></Pressable>)}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  statusStrip: { gap: 8, paddingVertical: 12 }, chip: { minWidth: 74, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' }, search: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 }, toolRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }, toolButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }, clearButton: { paddingHorizontal: 6, paddingVertical: 9 }, textButton: { paddingHorizontal: 6, paddingVertical: 9 }, sortOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, sortOption: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
});
