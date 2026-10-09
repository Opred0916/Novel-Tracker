import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookCover } from '../../books/BookCover';
import type { AnnualRecap, RecapNote, RecapBook } from '../../books/annualRecapRepository';
import { useAnnualRecapRepository } from '../../storage/AppProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { UI_LAYOUT } from '../../ui/layout';

function ordinalLabel(ordinal: number): string {
  if (ordinal === 1) return '首刷';
  if (ordinal === 2) return '二刷';
  if (ordinal === 3) return '三刷';
  return `第 ${ordinal} 次`;
}

function excerpt(body: string): string {
  const compact = body.replace(/\s+/g, ' ').trim();
  return compact.length > 100 ? `${compact.slice(0, 100)}…` : compact;
}

function ThoughtCard({ note, onPress }: { note: RecapNote; onPress: () => void }) {
  const { theme } = useTheme();
  return <Pressable accessibilityRole="button" style={[styles.thought, { borderTopColor: theme.border }]} onPress={onPress}>
    <Text style={[styles.thoughtMeta, { color: theme.primary }]}>{note.bookTitle} · {note.recordedOn ?? '日期未记录'}{note.recordedTime ? ` ${note.recordedTime.slice(0, 5)}` : ''}</Text>
    <Text style={[styles.thoughtBody, { color: theme.text }]}>{excerpt(note.body)}</Text>
    {note.imageCount > 0 ? <Text style={[styles.imageHint, { color: theme.mutedText }]}>图片 {note.imageCount} 张</Text> : null}
  </Pressable>;
}

function BookRecapCard({ book, onPress }: { book: RecapBook; onPress: () => void }) {
  const { theme } = useTheme();
  return <Pressable accessibilityRole="button" style={[styles.bookCard, { borderTopColor: theme.border }]} onPress={onPress}>
    <BookCover title={book.title} bookId={book.bookId} uri={book.coverUri} size="small" showTitle />
    <View style={styles.bookInfo}>
      {book.coverUri ? <Text style={[styles.bookTitle, { color: theme.text }]}>{book.title}</Text> : null}
      {book.sessions.map(session => <Text key={session.id} style={[styles.session, { color: theme.mutedText }]}>
        {ordinalLabel(session.ordinal)} · {session.startedOn ?? '开始日期未记录'} → {session.endedOn}
      </Text>)}
    </View>
  </Pressable>;
}

export default function AnnualRecapPage() {
  const { theme } = useTheme();
  const repository = useAnnualRecapRepository();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [years, setYears] = useState<number[]>([]);
  const [recap, setRecap] = useState<AnnualRecap | null>(null);
  const [undatedThoughts, setUndatedThoughts] = useState<RecapNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUndated, setShowUndated] = useState(true);
  const requestVersion = useRef(0);

  const refresh = useCallback(() => {
    let active = true;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setLoading(true);
    setError('');
    setRecap(null);
    void repository.availableYears(new Date().getFullYear()).then(available => {
      if (active && requestVersion.current === version) setYears(available);
    }).catch(() => undefined);
    Promise.all([repository.getYear(year), repository.listUndatedThoughts()]).then(([nextRecap, undated]) => {
      if (!active || requestVersion.current !== version) return;
      setRecap(nextRecap);
      setUndatedThoughts(undated);
      setLoading(false);
    }).catch(() => {
      if (!active || requestVersion.current !== version) return;
      setRecap(null);
      setLoading(false);
      setError('读取年度回顾失败，请重试');
    });
    return () => { active = false; };
  }, [repository, year]);
  useFocusEffect(refresh);

  function openBook(bookId: string) {
    router.push({ pathname: '/book/[id]', params: { id: bookId } });
  }

  function openThought(note: RecapNote) {
    router.push({ pathname: '/book/[id]', params: { id: note.bookId, focusNoteId: note.id } });
  }

  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>年度阅读回顾</Text>
    <View style={styles.yearRow}>
      <Text style={[styles.yearLabel, { color: theme.mutedText }]}>选择年份</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearOptions}>
        {(years.length ? years : [year]).map(option => <Pressable key={option} accessibilityRole="button" onPress={() => setYear(option)} style={[styles.yearButton, { backgroundColor: theme.card, borderColor: theme.border }, option === year && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
          <Text style={[styles.yearButtonText, { color: option === year ? theme.card : theme.text }]}>{option}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
    {loading ? <ActivityIndicator accessibilityLabel="正在读取年度回顾" color={theme.primary} /> : null}
    {error ? <View style={styles.errorRow}><Text style={[styles.error, { color: theme.danger }]}>{error}</Text><Pressable accessibilityRole="button" onPress={refresh}><Text style={[styles.link, { color: theme.primary }]}>重试</Text></Pressable></View> : null}
    {recap ? <>
      <Text style={[styles.selectedYear, { color: theme.text }]}>{recap.year} 年</Text>
      <View style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: theme.primarySoft }]}><Text style={[styles.statNumber, { color: theme.primary }]}>{recap.finishedBookCount}</Text><Text style={[styles.statLabel, { color: theme.text }]}>读完 {recap.finishedBookCount} 本</Text></View>
        <View style={[styles.stat, { backgroundColor: theme.primarySoft }]}><Text style={[styles.statNumber, { color: theme.primary }]}>{recap.completedReadingCount}</Text><Text style={[styles.statLabel, { color: theme.text }]}>完成阅读 {recap.completedReadingCount} 次</Text></View>
        <View style={[styles.stat, { backgroundColor: theme.primarySoft }]}><Text style={[styles.statNumber, { color: theme.primary }]}>{recap.thoughtCount}</Text><Text style={[styles.statLabel, { color: theme.text }]}>留下 {recap.thoughtCount} 条想法</Text></View>
      </View>
      <Text style={[styles.help, { color: theme.mutedText }]}>仅统计记录了结束日期的读完记录；同一本书多次读完会分别计入完成次数。</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/settings/themed-recap', params: { year: String(recap.year) } })} style={[styles.secondary, { borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>主题回顾卡片</Text></Pressable>
      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>这一年读过的书</Text>
        {recap.books.length ? recap.books.map(book => <BookRecapCard key={book.bookId} book={book} onPress={() => openBook(book.bookId)} />) : <Text style={[styles.empty, { color: theme.mutedText }]}>这一年还没有带完成日期的阅读记录</Text>}
      </View>
      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>那时的想法</Text>
        {recap.thoughts.length ? recap.thoughts.map(note => <ThoughtCard key={note.id} note={note} onPress={() => openThought(note)} />) : <Text style={[styles.empty, { color: theme.mutedText }]}>这一年还没有记录想法</Text>}
      </View>
      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Pressable accessibilityRole="button" style={styles.undatedHeading} onPress={() => setShowUndated(value => !value)}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>日期未记录</Text>
          <Text style={[styles.link, { color: theme.primary }]}>{showUndated ? '收起' : '展开'}</Text>
        </Pressable>
        {showUndated ? <><Text style={[styles.help, { color: theme.mutedText }]}>这些旧摘记没有原始日期，不归入任何年份。</Text>
          {undatedThoughts.length ? undatedThoughts.map(note => <ThoughtCard key={note.id} note={note} onPress={() => openThought(note)} />) : <Text style={[styles.empty, { color: theme.mutedText }]}>没有日期未记录的摘记</Text>}</> : null}
      </View>
      {!recap.books.length && !recap.thoughts.length ? <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={[styles.secondary, { borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>去书架添加或导入</Text></Pressable> : null}
    </> : null}
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.secondary, { borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>返回书库概览</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: UI_LAYOUT.pageInset, gap: UI_LAYOUT.sectionGap, paddingBottom: 100 },
  heading: { fontSize: 26, fontWeight: '700' },
  yearRow: { gap: 10 },
  yearLabel: { color: '#766f68', fontWeight: '600' },
  yearOptions: { gap: 8 },
  yearButton: { borderWidth: 1, borderColor: '#d8d0c7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff' },
  yearButtonActive: { backgroundColor: '#28584E', borderColor: '#28584E' },
  yearButtonText: { color: '#302a25', fontWeight: '600' },
  yearButtonTextActive: { color: '#fff' },
  selectedYear: { fontSize: 20, fontWeight: '700', color: '#302a25' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: UI_LAYOUT.groupRadius, padding: 12, gap: 4 },
  statNumber: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, lineHeight: 17 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: UI_LAYOUT.groupRadius, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#302a25' },
  undatedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookCard: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#eee7df', paddingTop: 12 },
  bookInfo: { flex: 1, gap: 6 },
  bookTitle: { fontSize: 17, fontWeight: '700', color: '#302a25' },
  session: { color: '#766f68', fontSize: 13, lineHeight: 19 },
  thought: { borderTopWidth: 1, borderTopColor: '#eee7df', paddingTop: 12, gap: 5 },
  thoughtMeta: { color: '#28584E', fontSize: 13, fontWeight: '600' },
  thoughtBody: { color: '#302a25', fontSize: 15, lineHeight: 22 },
  imageHint: { color: '#766f68', fontSize: 12 },
  help: { color: '#766f68', lineHeight: 20 },
  empty: { color: '#766f68', lineHeight: 20 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: '#b52626', flex: 1 },
  link: { color: '#28584E', fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: '#28584E', fontWeight: '700' },
});
