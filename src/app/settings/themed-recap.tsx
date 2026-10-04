import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookCover } from '../../books/BookCover';
import type { RecapShareThemeId } from '../../books/recapShareSnapshot';
import type { ThemeRecapBook, ThemedRecap } from '../../books/themedRecapRepository';
import { useAnnualRecapRepository, useThemedRecapRepository } from '../../storage/AppProvider';
import { useTheme } from '../../theme/ThemeProvider';

function ThemeBook({ book, onPress }: { book: ThemeRecapBook; onPress(): void }) {
  const { theme } = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.book, { borderTopColor: theme.border }]}>
    <BookCover title={book.title} bookId={book.bookId} uri={book.coverUri} size="small" showTitle={false} />
    <View style={styles.bookInfo}><Text style={[styles.bookTitle, { color: theme.text }]}>{book.title}</Text>{book.sessions.map(session => <Text key={session.id} style={[styles.session, { color: theme.mutedText }]}>{session.ordinal >= 2 ? `第 ${session.ordinal} 次` : session.outcome === 'dropped' ? '弃读' : '读完'} · {session.endedOn}</Text>)}</View>
  </Pressable>;
}

function ThemeCard({ title, description, books, onBook, onImage }: { title: string; description: string; books: ThemeRecapBook[]; onBook(bookId: string): void; onImage(): void }) {
  const { theme } = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.description, { color: theme.mutedText }]}>{description}</Text>{books.length ? <Pressable accessibilityRole="button" accessibilityLabel={`制作${title}图片`} onPress={onImage} style={[styles.imageButton, { backgroundColor: theme.primarySoft }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>制作图片</Text></Pressable> : null}{books.length ? books.map(book => <ThemeBook key={book.bookId} book={book} onPress={() => onBook(book.bookId)} />) : <Text style={[styles.empty, { color: theme.mutedText }]}>这一年还没有符合条件的记录</Text>}</View>;
}

export default function ThemedRecapPage() {
  const { theme } = useTheme();
  const annualRepository = useAnnualRecapRepository();
  const repository = useThemedRecapRepository();
  const params = useLocalSearchParams<{ year?: string | string[] }>();
  const initialYear = typeof params.year === 'string' && /^\d{4}$/.test(params.year) ? Number(params.year) : new Date().getFullYear();
  const [year, setYear] = useState(initialYear);
  const [years, setYears] = useState<number[]>([]);
  const [recap, setRecap] = useState<ThemedRecap | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const version = useRef(0);

  const refresh = useCallback(() => {
    let active = true;
    const request = ++version.current;
    setLoading(true); setError(''); setRecap(null);
    void Promise.all([repository.availableYears(new Date().getFullYear()), annualRepository.availableYears(new Date().getFullYear())]).then(([themedYears, annualYears]) => { if (active && version.current === request) setYears([...new Set([...themedYears, ...annualYears])].sort((left, right) => right - left)); }).catch(() => undefined);
    void repository.getYear(year).then(value => { if (active && version.current === request) { setRecap(value); setLoading(false); } }).catch(() => { if (active && version.current === request) { setError('读取主题回顾失败，请重试'); setLoading(false); } });
    return () => { active = false; };
  }, [annualRepository, repository, year]);
  useFocusEffect(refresh);
  const openImage = (themeId: RecapShareThemeId) => { if (recap) router.push({ pathname: '/settings/recap-share', params: { year: String(recap.year), theme: themeId } }); };

  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>主题回顾卡片</Text>
    <Text style={[styles.subtitle, { color: theme.mutedText }]}>把这一年的阅读轨迹整理成三个主题。</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>{(years.length ? years : [year]).map(option => <Pressable key={option} accessibilityRole="button" onPress={() => setYear(option)} style={[styles.year, { backgroundColor: theme.card, borderColor: theme.border }, option === year && { backgroundColor: theme.primary, borderColor: theme.primary }]}><Text style={{ color: option === year ? theme.card : theme.text, fontWeight: '700' }}>{option}</Text></Pressable>)}</ScrollView>
    {loading ? <ActivityIndicator accessibilityLabel="正在读取主题回顾" color={theme.primary} /> : null}
    {error ? <View style={styles.errorRow}><Text style={[styles.error, { color: theme.danger }]}>{error}</Text><Pressable accessibilityRole="button" onPress={refresh}><Text style={[styles.link, { color: theme.primary }]}>重试</Text></Pressable></View> : null}
    {recap ? <><Text style={[styles.selectedYear, { color: theme.text }]}>{recap.year} 年</Text><ThemeCard title="今年二刷成功" description="这一年完成了第二次或更多次阅读。" books={recap.rereadSuccess} onImage={() => openImage('rereadSuccess')} onBook={bookId => router.push({ pathname: '/book/[id]', params: { id: bookId } })} /><ThemeCard title="五星书" description="当前评分为五星，并且这一年确实读完。" books={recap.fiveStar} onImage={() => openImage('fiveStar')} onBook={bookId => router.push({ pathname: '/book/[id]', params: { id: bookId } })} /><ThemeCard title="弃读书" description="这一年留下过弃读记录。" books={recap.dropped} onImage={() => openImage('dropped')} onBook={bookId => router.push({ pathname: '/book/[id]', params: { id: bookId } })} /></> : null}
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.secondary, { borderColor: theme.primary }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>返回年度回顾</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, gap: 16, paddingBottom: 50 }, heading: { fontSize: 26, fontWeight: '800' }, subtitle: { fontSize: 15 }, years: { gap: 8 }, year: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }, selectedYear: { fontSize: 20, fontWeight: '700' }, card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 }, cardTitle: { fontSize: 19, fontWeight: '800' }, description: { lineHeight: 20 }, imageButton: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 10 }, book: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingTop: 12, marginTop: 4 }, bookInfo: { flex: 1, gap: 6, justifyContent: 'center' }, bookTitle: { fontSize: 17, fontWeight: '700' }, session: { fontSize: 13 }, empty: { paddingVertical: 8 }, errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, error: { flex: 1 }, link: { fontWeight: '700' }, secondary: { borderWidth: 1, borderRadius: 12, padding: 15, alignItems: 'center' },
});
