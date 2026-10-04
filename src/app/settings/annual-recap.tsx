import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookCover } from '../../books/BookCover';
import type { AnnualRecap, RecapNote, RecapBook } from '../../books/annualRecapRepository';
import { useAnnualRecapRepository } from '../../storage/AppProvider';

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
  return <Pressable accessibilityRole="button" style={styles.thought} onPress={onPress}>
    <Text style={styles.thoughtMeta}>{note.bookTitle} · {note.recordedOn ?? '日期未记录'}{note.recordedTime ? ` ${note.recordedTime.slice(0, 5)}` : ''}</Text>
    <Text style={styles.thoughtBody}>{excerpt(note.body)}</Text>
    {note.imageCount > 0 ? <Text style={styles.imageHint}>图片 {note.imageCount} 张</Text> : null}
  </Pressable>;
}

function BookRecapCard({ book, onPress }: { book: RecapBook; onPress: () => void }) {
  return <Pressable accessibilityRole="button" style={styles.bookCard} onPress={onPress}>
    <BookCover title={book.title} uri={book.coverUri} size="small" showTitle={false} />
    <View style={styles.bookInfo}>
      <Text style={styles.bookTitle}>{book.title}</Text>
      {book.sessions.map(session => <Text key={session.id} style={styles.session}>
        {ordinalLabel(session.ordinal)} · {session.startedOn ?? '开始日期未记录'} → {session.endedOn}
      </Text>)}
    </View>
  </Pressable>;
}

export default function AnnualRecapPage() {
  const repository = useAnnualRecapRepository();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [years, setYears] = useState<number[]>([]);
  const [recap, setRecap] = useState<AnnualRecap | null>(null);
  const [undatedThoughts, setUndatedThoughts] = useState<RecapNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([repository.availableYears(new Date().getFullYear()), repository.getYear(year), repository.listUndatedThoughts()]).then(([available, nextRecap, undated]) => {
      if (!active) return;
      setYears(available);
      setRecap(nextRecap);
      setUndatedThoughts(undated);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
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

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.heading}>年度阅读回顾</Text>
    <View style={styles.yearRow}>
      <Text style={styles.yearLabel}>选择年份</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearOptions}>
        {(years.length ? years : [year]).map(option => <Pressable key={option} accessibilityRole="button" onPress={() => setYear(option)} style={[styles.yearButton, option === year && styles.yearButtonActive]}>
          <Text style={[styles.yearButtonText, option === year && styles.yearButtonTextActive]}>{option}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
    {loading ? <ActivityIndicator accessibilityLabel="正在读取年度回顾" color="#593f72" /> : null}
    {error ? <View style={styles.errorRow}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={refresh}><Text style={styles.link}>重试</Text></Pressable></View> : null}
    {recap ? <>
      <Text style={styles.selectedYear}>{recap.year} 年</Text>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statNumber}>{recap.finishedBookCount}</Text><Text style={styles.statLabel}>读完 {recap.finishedBookCount} 本</Text></View>
        <View style={styles.stat}><Text style={styles.statNumber}>{recap.completedReadingCount}</Text><Text style={styles.statLabel}>完成阅读 {recap.completedReadingCount} 次</Text></View>
        <View style={styles.stat}><Text style={styles.statNumber}>{recap.thoughtCount}</Text><Text style={styles.statLabel}>留下 {recap.thoughtCount} 条想法</Text></View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>这一年读过的书</Text>
        {recap.books.length ? recap.books.map(book => <BookRecapCard key={book.bookId} book={book} onPress={() => openBook(book.bookId)} />) : <Text style={styles.empty}>这一年还没有带完成日期的阅读记录</Text>}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>那时的想法</Text>
        {recap.thoughts.length ? recap.thoughts.map(note => <ThoughtCard key={note.id} note={note} onPress={() => openThought(note)} />) : <Text style={styles.empty}>这一年还没有记录想法</Text>}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>日期未记录</Text>
        <Text style={styles.help}>这些旧摘记没有原始日期，不归入任何年份。</Text>
        {undatedThoughts.length ? undatedThoughts.map(note => <ThoughtCard key={note.id} note={note} onPress={() => openThought(note)} />) : <Text style={styles.empty}>没有日期未记录的摘记</Text>}
      </View>
    </> : null}
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>返回书库概览</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, paddingBottom: 50 },
  heading: { fontSize: 26, fontWeight: '700', color: '#302a25' },
  yearRow: { gap: 10 },
  yearLabel: { color: '#766f68', fontWeight: '600' },
  yearOptions: { gap: 8 },
  yearButton: { borderWidth: 1, borderColor: '#d8d0c7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff' },
  yearButtonActive: { backgroundColor: '#593f72', borderColor: '#593f72' },
  yearButtonText: { color: '#302a25', fontWeight: '600' },
  yearButtonTextActive: { color: '#fff' },
  selectedYear: { fontSize: 20, fontWeight: '700', color: '#302a25' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#593f72', borderRadius: 14, padding: 12, gap: 4 },
  statNumber: { color: '#fff', fontSize: 24, fontWeight: '700' },
  statLabel: { color: '#eee6f3', fontSize: 12, lineHeight: 17 },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#302a25' },
  bookCard: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#eee7df', paddingTop: 12 },
  bookInfo: { flex: 1, gap: 6 },
  bookTitle: { fontSize: 17, fontWeight: '700', color: '#302a25' },
  session: { color: '#766f68', fontSize: 13, lineHeight: 19 },
  thought: { borderTopWidth: 1, borderTopColor: '#eee7df', paddingTop: 12, gap: 5 },
  thoughtMeta: { color: '#593f72', fontSize: 13, fontWeight: '600' },
  thoughtBody: { color: '#302a25', fontSize: 15, lineHeight: 22 },
  imageHint: { color: '#766f68', fontSize: 12 },
  help: { color: '#766f68', lineHeight: 20 },
  empty: { color: '#766f68', lineHeight: 20 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: '#b52626', flex: 1 },
  link: { color: '#593f72', fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: '#593f72', fontWeight: '700' },
});
