import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useContext, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { TagPicker } from './TagPicker';
import { BOOK_TYPE_LABELS } from './TypePicker';
import { BOOK_TYPES, type BookStatus, type BookType, type Tag } from './types';
import type { BookSortOrder } from './bookSearch';
import { BookCard } from './BookCard';
import { BulkOrganizePanel } from './BulkOrganizePanel';
import { useBookSearch } from './useBookSearch';
import type { LibraryOverview } from './libraryOverviewRepository';
import { useBookSearchRepository, useBulkOrganizeRepository, useLibraryOverviewRepository, useTags } from '../storage/AppProvider';
import { useBooks } from '../storage/AppProvider';
import { BookshelfToolbar } from './BookshelfToolbar';
import { useTheme } from '../theme/ThemeProvider';
import { selectWantToReadBook } from './randomWantToRead';
import { RandomWantToReadSheet } from './RandomWantToReadSheet';

const BOOK_SORT_OPTIONS: { value: BookSortOrder; label: string }[] = [
  { value: 'recently_updated', label: '最近修改' },
  { value: 'recently_finished', label: '最近读完' },
  { value: 'recently_added', label: '最近添加' },
  { value: 'rating_high', label: '评分从高到低' },
];

export default function Bookshelf() {
  const { theme } = useTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const searchRepo = useBookSearchRepository();
  const booksRepo = useBooks();
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
  const [randomPick, setRandomPick] = useState<{ book: import('./types').Book | null; candidateCount: number } | null>(null);
  const [randomBusy, setRandomBusy] = useState(false);
  const [randomError, setRandomError] = useState('');
  const previousRandomId = useRef<string | null>(null);
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

  async function pickRandomWantToRead() {
    if (randomBusy) return;
    setRandomBusy(true);
    setRandomError('');
    try {
      const books = await booksRepo.list();
      const candidates = books.filter(book => book.status === 'want_to_read');
      const selected = selectWantToReadBook(books, previousRandomId.current);
      previousRandomId.current = selected?.id ?? previousRandomId.current;
      setRandomPick({ book: selected, candidateCount: candidates.length });
    } catch {
      setRandomError('随机抽取失败，请重试');
    } finally {
      setRandomBusy(false);
    }
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

  return <View style={[styles.page, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>把喜欢的故事留在这里</Text>
    <Text style={[styles.subheading, { color: theme.mutedText }]}>找书、记录和整理都在这里完成</Text>
    <BookshelfToolbar
      status={status}
      statusCounts={{ all: overview?.totalBooks ?? 0, want_to_read: overview?.byStatus.want_to_read ?? 0, reading: overview?.byStatus.reading ?? 0, finished: overview?.byStatus.finished ?? 0, dropped: overview?.byStatus.dropped ?? 0 }}
      onStatusChange={setStatus}
      query={query}
      onQueryChange={setQuery}
      sortLabel={BOOK_SORT_OPTIONS.find(option => option.value === sortOrder)?.label ?? '最近修改'}
      sortOptions={BOOK_SORT_OPTIONS}
      sortOrder={sortOrder}
      showSortOptions={showSortOptions}
      onToggleSort={() => setShowSortOptions(value => !value)}
      onSortChange={value => { setSortOrder(value); setShowSortOptions(false); }}
      activeFilterCount={activeFilterCount}
      hasConditions={hasConditions}
      onClearFilters={clearFilters}
      onToggleFilters={() => setShowFilters(value => !value)}
      onEnterBulk={enterBulkMode}
      onRandomPick={() => { void pickRandomWantToRead(); }}
      bulkMode={bulkMode}
    />
    {randomError ? <View style={styles.errorRow}><Text style={[styles.error, { color: theme.danger }]}>{randomError}</Text><Pressable accessibilityRole="button" onPress={() => { void pickRandomWantToRead(); }}><Text style={[styles.link, { color: theme.primary }]}>重试</Text></Pressable></View> : null}
    {overviewError ? <Text style={[styles.error, { color: theme.danger }]}>{overviewError}</Text> : null}
    {tagError ? <Text style={[styles.error, { color: theme.danger }]}>{tagError}</Text> : null}
    {searchError ? <View style={styles.errorRow}><Text style={[styles.error, { color: theme.danger }]}>{searchError}</Text><Pressable accessibilityRole="button" onPress={retry}><Text style={[styles.link, { color: theme.primary }]}>重试</Text></Pressable></View> : null}
    {loading && results.length ? <ActivityIndicator accessibilityLabel="正在搜索" color={theme.primary} style={styles.inlineLoading} /> : null}
    {bulkMode ? <View style={[styles.bulkBar, { backgroundColor: theme.primarySoft }]}>
      <Text style={[styles.bulkCount, { color: theme.text, fontWeight: '700' }]}>已选 {selectedBooks.size} 本</Text>
      <View style={styles.bulkActions}>
        <Pressable accessibilityRole="button" disabled={!resultsCurrent || loading || Boolean(searchError)} onPress={selectAllCurrentResults}><Text style={[styles.link, { color: theme.primary }]}>全选当前结果</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!selectedBooks.size} onPress={() => setShowSelected(value => !value)}><Text style={[styles.link, { color: theme.primary }]}>查看已选</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!selectedBooks.size} onPress={() => setShowBulkPanel(true)}><Text style={[styles.link, { color: theme.primary }]}>继续整理</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={cancelBulkMode}><Text style={[styles.link, { color: theme.primary }]}>取消整理</Text></Pressable>
      </View>
      {showSelected ? <View style={styles.selectedList}>{[...selectedBooks.entries()].map(([id, selected]) => <View key={id} style={styles.selectedRow}>
        <Text style={[styles.selectedName, { color: theme.mutedText }]}>{selected.title}{selected.author ? ` · ${selected.author}` : ''}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`移除${selected.title}`} onPress={() => removeSelected(id)}><Text style={[styles.link, { color: theme.primary }]}>移除</Text></Pressable>
      </View>)}</View> : null}
    </View> : null}
    <FlatList data={results} keyExtractor={item => item.book.id} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
      ListHeaderComponent={showFilters ? <View style={styles.filters}>
        <Text style={[styles.filterTitle, { color: theme.text }]}>作品类型</Text>
        <View style={styles.chips}>{[null, ...BOOK_TYPES].map(value => <Pressable key={value ?? 'all'}
          accessibilityRole="radio" accessibilityState={{ checked: bookType === value }} onPress={() => setBookType(value)}
          style={[styles.chip, { backgroundColor: bookType === value ? theme.primarySoft : theme.card, borderColor: bookType === value ? theme.primary : theme.border }]}>
          <Text style={{ color: bookType === value ? theme.primary : theme.text, fontWeight: bookType === value ? '700' : '500' }}>{value === null ? '全部类型' : BOOK_TYPE_LABELS[value]}</Text>
        </Pressable>)}</View>
        <Text style={[styles.filterTitle, { color: theme.text }]}>标签（可多选）</Text>
        <TagPicker tags={tags} selectedIds={tagIds} onChange={setTagIds} searchable />
      </View> : null}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="正在搜索" color={theme.primary} /> : searchError ? null : <View style={styles.empty}><Text style={[styles.emptyTitle, { color: theme.text }]}>{hasConditions ? '没有符合条件的小说' : '书架还是空的'}</Text><Text style={[styles.subheading, { color: theme.mutedText }]}>{hasConditions ? '试试清除筛选。' : '先记下一本想读的小说吧。'}</Text></View>}
      renderItem={({ item }) => <BookCard book={item.book} matchedNoteSnippet={item.matchedNoteSnippet} matchedImage={item.matchedImage} onPress={() => router.push({ pathname: '/book/[id]', params: { id: item.book.id, ...(item.matchedImage ? { focusImageId: item.matchedImage.imageId } : {}) } })}
        selection={bulkMode ? { checked: selectedBooks.has(item.book.id), onToggle: () => toggleSelected(item.book) } : undefined} />}
    />
    <Link href="/book/new" asChild><Pressable accessibilityRole="button" style={[styles.add, { bottom: insets.bottom + 8, backgroundColor: theme.primary }]}><Text style={styles.addText}>＋ 添加小说</Text></Pressable></Link>
    <Modal visible={randomPick !== null} transparent animationType="slide" onRequestClose={() => setRandomPick(null)}>
      <View style={styles.modalBackdrop}><Pressable accessibilityRole="button" accessibilityLabel="关闭随机抽取" style={styles.modalDismiss} onPress={() => setRandomPick(null)} /><View style={styles.modalSheet}><RandomWantToReadSheet book={randomPick?.book ?? null} candidateCount={randomPick?.candidateCount ?? 0} onClose={() => setRandomPick(null)} onPickAgain={() => { void pickRandomWantToRead(); }} onOpen={id => { setRandomPick(null); router.push({ pathname: '/book/[id]', params: { id } }); }} /></View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 22 }, heading: { fontSize: 26, fontWeight: '700', marginTop: 10 },
  subheading: { marginTop: 8 }, error: { color: '#b52626' }, list: { flexGrow: 1, paddingTop: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  inlineLoading: { alignSelf: 'flex-start', marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }, link: { fontWeight: '600' },
  bulkBar: { marginTop: 12, padding: 14, borderRadius: 14, gap: 10 }, bulkCount: { fontWeight: '700' }, bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  selectedList: { gap: 8 }, selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, selectedName: { flex: 1 },
  filters: { gap: 10, paddingBottom: 20 }, filterTitle: { fontWeight: '600', marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' }, emptyTitle: { fontSize: 20, fontWeight: '600', color: '#302a25' },
  add: { position: 'absolute', left: 22, right: 22, padding: 17, borderRadius: 16, alignItems: 'center' }, addText: { color: 'white', fontWeight: '700', fontSize: 17 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.28)' }, modalDismiss: { flex: 1 }, modalSheet: { paddingBottom: 0 },
});
