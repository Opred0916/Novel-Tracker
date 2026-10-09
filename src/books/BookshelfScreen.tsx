import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useContext, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { type BookStatus, type BookType, type Tag } from './types';
import type { BookSortOrder } from './bookSearch';
import { BookCard } from './BookCard';
import { BulkOrganizePanel } from './BulkOrganizePanel';
import { useBookSearch } from './useBookSearch';
import type { LibraryOverview } from './libraryOverviewRepository';
import { useBookSearchRepository, useBooks, useBulkOrganizeRepository, useLibraryOverviewRepository, useNotes, useReadingHistory, useTags } from '../storage/AppProvider';
import { BookshelfToolbar } from './BookshelfToolbar';
import { BookshelfToolsSheet, type BookshelfSheet } from './BookshelfToolsSheet';
import { useTheme } from '../theme/ThemeProvider';
import { selectWantToReadBook } from './randomWantToRead';
import { RandomWantToReadSheet } from './RandomWantToReadSheet';
import { BulkSelectionBar } from './BulkSelectionBar';
import { QuickRecordSheet, type QuickRecordResult } from './QuickRecordSheet';
import { FirstUseCard } from '../dataSafety/FirstUseCard';
import { dataSafetyPreferences } from '../dataSafety/preferences';
import { shouldShowIntro } from '../dataSafety/visibility';

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
  const historyRepo = useReadingHistory();
  const notesRepo = useNotes();
  const bulkOrganizeRepository = useBulkOrganizeRepository();
  const overviewRepository = useLibraryOverviewRepository();
  const tagRepo = useTags();
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BookStatus | null>(null);
  const [bookType, setBookType] = useState<BookType | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<BookSortOrder>('recently_updated');
  const [activeSheet, setActiveSheet] = useState<BookshelfSheet>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Map<string, { title: string; author: string | null }>>(new Map());
  const [tagError, setTagError] = useState('');
  const [overview, setOverview] = useState<LibraryOverview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [randomPick, setRandomPick] = useState<{ book: import('./types').Book | null; candidateCount: number } | null>(null);
  const [randomVisible, setRandomVisible] = useState(false);
  const [randomBusy, setRandomBusy] = useState(false);
  const [randomError, setRandomError] = useState('');
  const [quickRecordBookId, setQuickRecordBookId] = useState<string | null>(null);
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [introDismissedThisSession, setIntroDismissedThisSession] = useState(false);
  const previousRandomId = useRef<string | null>(null);
  const randomRequest = useRef(0);
  const hasFocused = useRef(false);
  const { results, loading, error: searchError, resultsCurrent, retry } = useBookSearch(searchRepo, { query, status, bookType, tagIds, sortOrder });
  useFocusEffect(useCallback(() => {
    let active = true;
    setOverview(null);
    setIntroSeen(null);
    if (hasFocused.current) retry();
    else hasFocused.current = true;
    tagRepo.list().then(items => { if (active) { setTags(items); setTagError(''); } }).catch(() => { if (active) setTagError('读取标签失败'); });
    overviewRepository.getOverview(new Date().getFullYear()).then(value => { if (active) { setOverview(value); setOverviewError(''); } }).catch(() => { if (active) setOverviewError('状态数量暂时无法读取'); });
    dataSafetyPreferences.read('introSeen').then(value => { if (active) setIntroSeen(value); }).catch(() => { if (active) setIntroSeen(null); });
    return () => { active = false; };
  }, [overviewRepository, retry, tagRepo]));

  const activeFilterCount = (bookType ? 1 : 0) + tagIds.length;
  const hasConditions = query.trim().length > 0 || activeFilterCount > 0;
  const showIntro = shouldShowIntro({ introSeen: introDismissedThisSession ? true : introSeen, totalBooks: overview?.totalBooks ?? null, status, hasConditions, loading, resultsCurrent, bulkMode });

  function handleIntro(learnMore: boolean) {
    setIntroDismissedThisSession(true);
    void dataSafetyPreferences.mark('introSeen').catch(() => undefined);
    if (learnMore) router.push('/settings/data-safety');
  }

  function clearFilters() {
    setBookType(null);
    setTagIds([]);
  }

  async function pickRandomWantToRead() {
    if (randomBusy) return;
    const request = ++randomRequest.current;
    setRandomVisible(true);
    setRandomBusy(true);
    setRandomError('');
    try {
      const books = await booksRepo.list();
      if (randomRequest.current !== request) return;
      const candidates = books.filter(book => book.status === 'want_to_read');
      const selected = selectWantToReadBook(books, previousRandomId.current);
      previousRandomId.current = selected?.id ?? previousRandomId.current;
      setRandomPick({ book: selected, candidateCount: candidates.length });
    } catch {
      if (randomRequest.current === request) setRandomError('随机抽取失败，请重试');
    } finally {
      if (randomRequest.current === request) setRandomBusy(false);
    }
  }

  function closeRandomSheet() {
    randomRequest.current += 1;
    setRandomVisible(false);
    setRandomBusy(false);
  }

  function enterBulkMode() {
    setBulkMode(true);
  }

  function cancelBulkMode() {
    setBulkMode(false);
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

  async function completeBulkOrganize() {
    setShowBulkPanel(false);
    setBulkMode(false);
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

  function quickRecordChanged(result: QuickRecordResult) {
    retry();
    if (result !== 'note_saved') {
      void overviewRepository.getOverview(new Date().getFullYear())
        .then(value => { setOverview(value); setOverviewError(''); })
        .catch(() => setOverviewError('状态数量暂时无法读取'));
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
    <Text style={[styles.heading, { color: theme.text }]}>我的书架</Text>
    <Text style={[styles.subheading, { color: theme.mutedText }]}>找书、记录和整理都在这里完成</Text>
    <BookshelfToolbar
      status={status}
      statusCounts={{ all: overview?.totalBooks ?? 0, want_to_read: overview?.byStatus.want_to_read ?? 0, reading: overview?.byStatus.reading ?? 0, finished: overview?.byStatus.finished ?? 0, dropped: overview?.byStatus.dropped ?? 0 }}
      onStatusChange={setStatus}
      query={query}
      onQueryChange={setQuery}
      onClearQuery={() => setQuery('')}
      sortLabel={BOOK_SORT_OPTIONS.find(option => option.value === sortOrder)?.label ?? '最近修改'}
      activeSheet={activeSheet}
      onOpenSheet={setActiveSheet}
      activeFilterCount={activeFilterCount}
    />
    <BookshelfToolsSheet visible={activeSheet !== null} sheet={activeSheet} sortOptions={BOOK_SORT_OPTIONS} sortOrder={sortOrder} bookType={bookType} tags={tags} tagIds={tagIds} onSortChange={value => setSortOrder(value)} onBookTypeChange={setBookType} onTagIdsChange={setTagIds} onResetFilters={clearFilters} onEnterBulk={enterBulkMode} onRandomPick={() => { void pickRandomWantToRead(); }} onClose={() => setActiveSheet(null)} />
    {randomError ? <View style={styles.errorRow}><Text style={[styles.error, { color: theme.danger }]}>{randomError}</Text><Pressable accessibilityRole="button" onPress={() => { void pickRandomWantToRead(); }}><Text style={[styles.link, { color: theme.primary }]}>重试</Text></Pressable></View> : null}
    {overviewError ? <Text style={[styles.error, { color: theme.danger }]}>{overviewError}</Text> : null}
    {tagError ? <Text style={[styles.error, { color: theme.danger }]}>{tagError}</Text> : null}
    {searchError ? <View style={styles.errorRow}><Text style={[styles.error, { color: theme.danger }]}>{searchError}</Text><Pressable accessibilityRole="button" onPress={retry}><Text style={[styles.link, { color: theme.primary }]}>重试</Text></Pressable></View> : null}
    {loading && results.length ? <ActivityIndicator accessibilityLabel="正在搜索" color={theme.primary} style={styles.inlineLoading} /> : null}
    {bulkMode ? <BulkSelectionBar selectedCount={selectedBooks.size} canSelectAll={Boolean(resultsCurrent && !loading && !searchError)} onCancel={cancelBulkMode} onSelectAll={selectAllCurrentResults} onContinue={() => setShowBulkPanel(true)} /> : null}
    <FlatList data={results} keyExtractor={item => item.book.id} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
      ListHeaderComponent={null}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="正在搜索" color={theme.primary} /> : searchError ? null : <View style={styles.empty}><Text style={[styles.emptyTitle, { color: theme.text }]}>{status ? `还没有${status === 'want_to_read' ? '想读' : status === 'reading' ? '在读' : status === 'finished' ? '读完' : '弃读'}的小说` : hasConditions ? '没有符合筛选条件的小说' : '书架还是空的'}</Text><Text style={[styles.subheading, { color: theme.mutedText }]}>{status ? '先添加一本小说吧。' : hasConditions ? '可以调整筛选条件。' : '先记下一本想读的小说吧。'}</Text>{showIntro ? <FirstUseCard onDismiss={() => handleIntro(false)} onLearnMore={() => handleIntro(true)} /> : null}</View>}
      renderItem={({ item }) => <BookCard book={item.book} matchedNoteSnippet={item.matchedNoteSnippet} matchedImage={item.matchedImage} onPress={() => router.push({ pathname: '/book/[id]', params: { id: item.book.id, ...(item.matchedImage ? { focusImageId: item.matchedImage.imageId } : {}) } })}
        selection={bulkMode ? { checked: selectedBooks.has(item.book.id), onToggle: () => toggleSelected(item.book) } : undefined}
        onQuickRecord={status === 'reading' && !bulkMode ? () => setQuickRecordBookId(item.book.id) : undefined} />}
    />
    <QuickRecordSheet visible={quickRecordBookId !== null} bookId={quickRecordBookId} books={booksRepo} history={historyRepo} notes={notesRepo} onClose={() => setQuickRecordBookId(null)} onChanged={quickRecordChanged} />
    {!bulkMode ? <Link href="/book/new" asChild><Pressable accessibilityRole="button" style={StyleSheet.flatten([styles.add, { bottom: insets.bottom + 8, backgroundColor: theme.primary }])}><Text style={styles.addText}>＋ 添加小说</Text></Pressable></Link> : null}
    <Modal visible={randomVisible} transparent animationType="slide" onRequestClose={closeRandomSheet}>
      <View style={styles.modalBackdrop}><Pressable accessibilityRole="button" accessibilityLabel="关闭随机抽取" style={styles.modalDismiss} onPress={closeRandomSheet} /><View style={styles.modalSheet}><RandomWantToReadSheet book={randomPick?.book ?? null} candidateCount={randomPick?.candidateCount ?? 0} loading={randomBusy} error={randomError || null} onClose={closeRandomSheet} onReroll={() => { void pickRandomWantToRead(); }} onRetry={() => { void pickRandomWantToRead(); }} onAddBook={() => { closeRandomSheet(); router.push('/book/new'); }} onOpenBook={id => { closeRandomSheet(); router.push({ pathname: '/book/[id]', params: { id } }); }} /></View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 22 }, heading: { fontSize: 26, fontWeight: '700', marginTop: 10 },
  subheading: { marginTop: 8 }, error: { color: '#b52626' }, list: { flexGrow: 1, paddingTop: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  inlineLoading: { alignSelf: 'flex-start', marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }, link: { fontWeight: '600' },
  filters: { gap: 10, paddingBottom: 20 }, filterTitle: { fontWeight: '600', marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' }, emptyTitle: { fontSize: 20, fontWeight: '600', color: '#302a25' },
  add: { position: 'absolute', left: 22, right: 22, padding: 17, borderRadius: 16, alignItems: 'center' }, addText: { color: 'white', fontWeight: '700', fontSize: 17 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.28)' }, modalDismiss: { flex: 1 }, modalSheet: { paddingBottom: 0 },
});
