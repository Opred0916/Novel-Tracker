import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TagPicker } from './TagPicker';
import { BOOK_TYPE_LABELS } from './TypePicker';
import { BOOK_STATUSES, BOOK_TYPES, type BookStatus, type BookType, type Tag } from './types';
import type { BookSortOrder } from './bookSearch';
import { BookCard } from './BookCard';
import { BulkOrganizePanel } from './BulkOrganizePanel';
import { useBookSearch } from './useBookSearch';
import { BOOK_STATUS_LABELS } from './status';
import type { LibraryOverview } from './libraryOverviewRepository';
import { useBookSearchRepository, useBulkOrganizeRepository, useLibraryOverviewRepository, useTags } from '../storage/AppProvider';

const BOOK_SORT_OPTIONS: { value: BookSortOrder; label: string }[] = [
  { value: 'recently_updated', label: '最近修改' },
  { value: 'recently_finished', label: '最近读完' },
  { value: 'recently_added', label: '最近添加' },
  { value: 'rating_high', label: '评分从高到低' },
];

export default function Bookshelf() {
  const searchRepo = useBookSearchRepository();
  const bulkOrganizeRepository = useBulkOrganizeRepository();
  const overviewRepository = useLibraryOverviewRepository();
  const tagRepo = useTags();
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BookStatus | null>(null);
  const [bookType, setBookType] = useState<BookType | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<BookSortOrder>('recently_updated');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [showSelected, setShowSelected] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Map<string, { title: string; author: string | null }>>(new Map());
  const [showFilters, setShowFilters] = useState(false);
  const [tagError, setTagError] = useState('');
  const [overview, setOverview] = useState<LibraryOverview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const hasFocused = useRef(false);
  const { results, loading, error: searchError, resultsCurrent, retry } = useBookSearch(searchRepo, { query, status, bookType, tagIds, sortOrder });
  useFocusEffect(useCallback(() => {
    let active = true;
    if (hasFocused.current) retry();
    else hasFocused.current = true;
    tagRepo.list().then(items => { if (active) { setTags(items); setTagError(''); } }).catch(() => { if (active) setTagError('读取标签失败'); });
    overviewRepository.getOverview(new Date().getFullYear()).then(value => { if (active) { setOverview(value); setOverviewError(''); } }).catch(() => { if (active) setOverviewError('状态数量暂时无法读取'); });
    return () => { active = false; };
  }, [overviewRepository, retry, tagRepo]));

  const activeFilterCount = (bookType ? 1 : 0) + tagIds.length;
  const hasConditions = query.trim().length > 0 || Boolean(status) || activeFilterCount > 0;

  function clearFilters() {
    setQuery('');
    setStatus(null);
    setBookType(null);
    setTagIds([]);
  }

  function enterBulkMode() {
    setBulkMode(true);
    setShowSelected(false);
  }

  function cancelBulkMode() {
    setBulkMode(false);
    setShowSelected(false);
    setSelectedBooks(new Map());
  }

  function toggleSelected(book: { id: string; title: string; author: string | null }) {
    setSelectedBooks(current => {
      const next = new Map(current);
      if (next.has(book.id)) next.delete(book.id);
      else next.set(book.id, { title: book.title, author: book.author });
      return next;
    });
  }

  function selectAllCurrentResults() {
    if (!resultsCurrent || loading || Boolean(searchError)) return;
    setSelectedBooks(current => {
      const next = new Map(current);
      for (const result of results) next.set(result.book.id, { title: result.book.title, author: result.book.author });
      return next;
    });
  }

  function removeSelected(id: string) {
    setSelectedBooks(current => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }

  async function completeBulkOrganize() {
    setShowBulkPanel(false);
    setBulkMode(false);
    setShowSelected(false);
    setSelectedBooks(new Map());
    retry();
    try { setOverview(await overviewRepository.getOverview(new Date().getFullYear())); setOverviewError(''); }
    catch { setOverviewError('状态数量暂时无法读取'); }
    try {
      setTags(await tagRepo.list());
    } catch {
      setTagError('读取标签失败');
    }
  }

  if (showBulkPanel) {
    return <View style={styles.page}>
      <BulkOrganizePanel
        selectedBooks={selectedBooks}
        tags={tags}
        repository={bulkOrganizeRepository}
        onComplete={() => { void completeBulkOrganize(); }}
        onCancel={() => setShowBulkPanel(false)}
      />
    </View>;
  }

  return <View style={styles.page}>
    <Text style={styles.heading}>把喜欢的故事留在这里</Text>
    <Text style={styles.subheading}>想读 · 在读 · 读完 · 弃读</Text>
    <View style={styles.statusFilters}>{[null, ...BOOK_STATUSES].map(value => <Pressable key={value ?? 'all'}
      accessibilityRole="radio" accessibilityState={{ checked: status === value }} onPress={() => setStatus(value)}
      style={[styles.chip, status === value && styles.chipSelected]}>
      <Text style={[styles.chipText, status === value && styles.chipSelectedText]}>{value === null ? '全部' : BOOK_STATUS_LABELS[value]}{overview ? ` ${value === null ? overview.totalBooks : overview.byStatus[value]} 本` : ''}</Text>
    </Pressable>)}</View>
    {overviewError ? <Text style={styles.error}>{overviewError}</Text> : null}
    {tagError ? <Text style={styles.error}>{tagError}</Text> : null}
    {searchError ? <View style={styles.errorRow}><Text style={styles.error}>{searchError}</Text><Pressable accessibilityRole="button" onPress={retry}><Text style={styles.link}>重试</Text></Pressable></View> : null}
    {loading && results.length ? <ActivityIndicator accessibilityLabel="正在搜索" color="#593f72" style={styles.inlineLoading} /> : null}
    <TextInput placeholder="搜索书名、作者、主角、摘记或图片文字" value={query} onChangeText={setQuery} style={styles.search} />
    <View style={styles.sortRow}>
      <Pressable accessibilityRole="button" onPress={() => setShowSortOptions(value => !value)}>
        <Text style={styles.link}>排序：{BOOK_SORT_OPTIONS.find(option => option.value === sortOrder)?.label}</Text>
      </Pressable>
      {showSortOptions ? <View style={styles.sortOptions}>{BOOK_SORT_OPTIONS.map(option => <Pressable key={option.value}
        accessibilityRole="radio" accessibilityState={{ checked: sortOrder === option.value }} onPress={() => { setSortOrder(option.value); setShowSortOptions(false); }}
        style={[styles.sortOption, sortOrder === option.value && styles.sortOptionSelected]}>
        <Text style={[styles.sortOptionText, sortOrder === option.value && styles.sortOptionSelectedText]}>{option.label}</Text>
      </Pressable>)}</View> : null}
    </View>
    <View style={styles.actions}>
      {!bulkMode ? <Pressable accessibilityRole="button" onPress={enterBulkMode}><Text style={styles.link}>批量整理</Text></Pressable> : null}
      <Pressable accessibilityRole="button" onPress={() => setShowFilters(value => !value)}><Text style={styles.link}>筛选条件{activeFilterCount ? `（${activeFilterCount}）` : ''}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={clearFilters}><Text style={styles.link}>清除筛选</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings/tags')}><Text style={styles.link}>快捷标签设置</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings/data')}><Text style={styles.link}>数据管理</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings/overview')}><Text style={styles.link}>书库概览</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings/backup')}><Text style={styles.link}>备份与恢复</Text></Pressable>
    </View>
    {bulkMode ? <View style={styles.bulkBar}>
      <Text style={styles.bulkCount}>已选 {selectedBooks.size} 本</Text>
      <View style={styles.bulkActions}>
        <Pressable accessibilityRole="button" disabled={!resultsCurrent || loading || Boolean(searchError)} onPress={selectAllCurrentResults}><Text style={styles.link}>全选当前结果</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!selectedBooks.size} onPress={() => setShowSelected(value => !value)}><Text style={styles.link}>查看已选</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!selectedBooks.size} onPress={() => setShowBulkPanel(true)}><Text style={styles.link}>继续整理</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={cancelBulkMode}><Text style={styles.link}>取消整理</Text></Pressable>
      </View>
      {showSelected ? <View style={styles.selectedList}>{[...selectedBooks.entries()].map(([id, selected]) => <View key={id} style={styles.selectedRow}>
        <Text style={styles.selectedName}>{selected.title}{selected.author ? ` · ${selected.author}` : ''}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`移除${selected.title}`} onPress={() => removeSelected(id)}><Text style={styles.link}>移除</Text></Pressable>
      </View>)}</View> : null}
    </View> : null}
    <FlatList data={results} keyExtractor={item => item.book.id} contentContainerStyle={styles.list}
      ListHeaderComponent={showFilters ? <View style={styles.filters}>
        <Text style={styles.filterTitle}>作品类型</Text>
        <View style={styles.chips}>{[null, ...BOOK_TYPES].map(value => <Pressable key={value ?? 'all'}
          accessibilityRole="radio" accessibilityState={{ checked: bookType === value }} onPress={() => setBookType(value)}
          style={[styles.chip, bookType === value && styles.chipSelected]}>
          <Text style={[styles.chipText, bookType === value && styles.chipSelectedText]}>{value === null ? '全部类型' : BOOK_TYPE_LABELS[value]}</Text>
        </Pressable>)}</View>
        <Text style={styles.filterTitle}>标签（可多选）</Text>
        <TagPicker tags={tags} selectedIds={tagIds} onChange={setTagIds} searchable />
      </View> : null}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="正在搜索" color="#593f72" /> : searchError ? null : <View style={styles.empty}><Text style={styles.emptyTitle}>{hasConditions ? '没有符合条件的小说' : '书架还是空的'}</Text><Text style={styles.subheading}>{hasConditions ? '试试清除筛选。' : '先记下一本想读的小说吧。'}</Text></View>}
      renderItem={({ item }) => <BookCard book={item.book} matchedNoteSnippet={item.matchedNoteSnippet} matchedImage={item.matchedImage} onPress={() => router.push({ pathname: '/book/[id]', params: { id: item.book.id, ...(item.matchedImage ? { focusImageId: item.matchedImage.imageId } : {}) } })}
        selection={bulkMode ? { checked: selectedBooks.has(item.book.id), onToggle: () => toggleSelected(item.book) } : undefined} />}
    />
    <Link href="/book/new" asChild><Pressable accessibilityRole="button" style={styles.add}><Text style={styles.addText}>＋ 添加小说</Text></Pressable></Link>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 22 }, heading: { fontSize: 26, fontWeight: '700', color: '#302a25', marginTop: 10 },
  subheading: { color: '#817871', marginTop: 8 }, error: { color: '#b52626' }, list: { flexGrow: 1, paddingTop: 22, paddingBottom: 20 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  inlineLoading: { alignSelf: 'flex-start', marginTop: 8 },
  search: { marginTop: 14, borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, backgroundColor: '#fff', padding: 12, fontSize: 16 },
  sortRow: { marginTop: 12 }, sortOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  sortOption: { borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  sortOptionSelected: { backgroundColor: '#593f72', borderColor: '#593f72' }, sortOptionText: { color: '#302a25' }, sortOptionSelectedText: { color: '#fff', fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }, link: { color: '#593f72', fontWeight: '600' },
  bulkBar: { marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: '#f3edf7', gap: 10 }, bulkCount: { color: '#302a25', fontWeight: '700' }, bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  selectedList: { gap: 8 }, selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, selectedName: { flex: 1, color: '#655e58' },
  filters: { gap: 10, paddingBottom: 20 }, filterTitle: { color: '#302a25', fontWeight: '600', marginTop: 8 },
  statusFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  chipSelected: { backgroundColor: '#593f72', borderColor: '#593f72' }, chipText: { color: '#302a25' }, chipSelectedText: { color: '#fff', fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' }, emptyTitle: { fontSize: 20, fontWeight: '600', color: '#302a25' },
  add: { backgroundColor: '#593f72', padding: 18, borderRadius: 16, alignItems: 'center' }, addText: { color: 'white', fontWeight: '700', fontSize: 17 },
});
