import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { ChoiceChip } from '../ui/ChoiceChip';
import { useTheme } from '../theme/ThemeProvider';
import { BOOK_TYPES, type BookType, type Tag } from './types';
import { BOOK_TYPE_LABELS } from './TypePicker';
import type { BookSortOrder } from './bookSearch';
import { TagPicker } from './TagPicker';

export type BookshelfSheet = 'sort' | 'filter' | 'more' | null;

type Props = {
  visible: boolean;
  sheet: BookshelfSheet;
  sortOptions: { value: BookSortOrder; label: string }[];
  sortOrder: BookSortOrder;
  bookType: BookType | null;
  tags: Tag[];
  tagIds: string[];
  onSortChange(order: BookSortOrder): void;
  onBookTypeChange(type: BookType | null): void;
  onTagIdsChange(ids: string[]): void;
  onResetFilters(): void;
  onEnterBulk(): void;
  onRandomPick(): void;
  onClose(): void;
};

export function BookshelfToolsSheet({ visible, sheet, sortOptions, sortOrder, bookType, tags, tagIds, onSortChange, onBookTypeChange, onTagIdsChange, onResetFilters, onEnterBulk, onRandomPick, onClose }: Props) {
  const { theme } = useTheme();
  if (!visible || !sheet) return null;
  const title = sheet === 'sort' ? '排序' : sheet === 'filter' ? '筛选' : '更多';
  return <BottomSheet visible title={title} onClose={onClose}>
    {sheet === 'sort' ? <View style={styles.section}>
      {sortOptions.map(option => <ChoiceChip key={option.value} label={option.label} selected={sortOrder === option.value} selectionRole="radio" onPress={() => { onSortChange(option.value); onClose(); }} />)}
    </View> : null}
    {sheet === 'filter' ? <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.text }]}>作品类型</Text>
      <View style={styles.group}>
        <ChoiceChip label="全部类型" selected={bookType === null} selectionRole="radio" onPress={() => onBookTypeChange(null)} />
        {BOOK_TYPES.map(type => <ChoiceChip key={type} label={BOOK_TYPE_LABELS[type]} selected={bookType === type} selectionRole="radio" onPress={() => onBookTypeChange(type)} />)}
      </View>
      <Text style={[styles.heading, { color: theme.text }]}>标签（可多选）</Text>
      <TagPicker tags={tags} selectedIds={tagIds} onChange={onTagIdsChange} searchable grouped />
      {bookType || tagIds.length ? <Pressable accessibilityRole="button" onPress={() => { onResetFilters(); onClose(); }} style={[styles.reset, { borderColor: theme.primary }]}><Text style={[styles.resetText, { color: theme.primary }]}>重置筛选</Text></Pressable> : null}
    </View> : null}
    {sheet === 'more' ? <View style={styles.section}>
      <Pressable accessibilityRole="button" onPress={() => { onClose(); onEnterBulk(); }} style={[styles.action, { backgroundColor: theme.primary }]}><Text style={styles.actionText}>批量整理</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { onClose(); onRandomPick(); }} style={[styles.action, { backgroundColor: theme.primarySoft, borderColor: theme.primary, borderWidth: 1 }]}><Text style={[styles.secondaryActionText, { color: theme.primary }]}>随机想读</Text></Pressable>
    </View> : null}
  </BottomSheet>;
}

const styles = StyleSheet.create({
  section: { gap: 12 }, heading: { fontSize: 16, fontWeight: '700', marginTop: 2 }, group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { alignItems: 'center', borderRadius: 14, paddingVertical: 14 }, actionText: { color: '#fff', fontSize: 16, fontWeight: '700' }, secondaryActionText: { fontSize: 16, fontWeight: '700' },
  reset: { alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 11 }, resetText: { fontWeight: '700' },
});
