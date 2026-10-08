import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { BookCover } from './BookCover';
import { AnnualSummarySharePanel } from './AnnualSummarySharePanel';
import type { AnnualStorySummary, AnnualSummaryBook } from './annualSummaryRepository';
import { annualBooksSentence, peakMonthSentence, type AnnualStoryPage } from './annualStoryPages';

function BookTile({ book, onPress, showRating = false }: { book: AnnualSummaryBook; onPress(): void; showRating?: boolean }) {
  const { theme } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`查看《${book.title}》`} onPress={onPress} style={styles.bookTile}>
    <BookCover title={book.title} bookId={book.bookId} uri={book.coverUri} size="small" showTitle />
    <Text accessibilityLabel={book.title} numberOfLines={2} style={[styles.bookName, { color: theme.text }]}>{book.title}</Text>
    {showRating && book.ratingHalfStars !== null ? <Text style={[styles.rating, { color: theme.rating }]}>★ {(book.ratingHalfStars / 2).toFixed(1)}</Text> : null}
  </Pressable>;
}

function BookRow({ books, onOpenBook, showRating = false }: { books: AnnualSummaryBook[]; onOpenBook(id: string): void; showRating?: boolean }) {
  return <View style={styles.bookRow}>{books.map(book => <BookTile key={book.bookId} book={book} showRating={showRating} onPress={() => onOpenBook(book.bookId)} />)}</View>;
}

function MonthChart({ summary }: { summary: AnnualStorySummary }) {
  const { theme } = useTheme();
  const max = Math.max(1, ...summary.months.map(month => month.bookCount));
  return <View style={styles.monthChart}>{summary.months.map(month => <View key={month.month} style={styles.monthColumn}>
    <Text style={[styles.monthCount, { color: theme.mutedText }]}>{month.bookCount || ''}</Text>
    <View style={[styles.monthBar, { backgroundColor: summary.peakMonths.includes(month.month) ? theme.primary : theme.primarySoft, height: 18 + (month.bookCount / max) * 92 }]} />
    <Text style={[styles.monthLabel, { color: theme.mutedText }]}>{month.month}</Text>
  </View>)}</View>;
}

export function AnnualStoryPageView({ page, summary, width, onOpenBook }: {
  page: AnnualStoryPage;
  summary: AnnualStorySummary;
  width: number;
  onOpenBook(bookId: string): void;
}) {
  const { theme } = useTheme();
  const pageStyle = [styles.page, { width, backgroundColor: theme.background }];
  const titleStyle = [styles.title, { color: theme.text }];
  const bodyStyle = [styles.body, { color: theme.mutedText }];

  if (page.id === 'cover') return <View style={pageStyle}>
    <View style={[styles.coverHero, { backgroundColor: theme.primary }]}>
      <Text style={styles.eyebrow}>{summary.year}</Text>
      <Text style={styles.coverTitle}>我的阅读回顾</Text>
      <Text style={styles.coverSubtitle}>这一年，我把喜欢的故事留了下来</Text>
      <View style={styles.coverCollage}>{summary.coverBooks.map((book, index) => <View key={book.bookId} style={{ transform: [{ rotate: `${(index % 3 - 1) * 3}deg` }] }}><BookCover title={book.title} bookId={book.bookId} uri={book.coverUri} size="small" showTitle /></View>)}</View>
    </View>
  </View>;

  if (page.id === 'books') return <ScrollView style={pageStyle} contentContainerStyle={styles.content}>
    <Text style={titleStyle}>今年读完</Text><Text style={[styles.bigNumber, { color: theme.primary }]}>{summary.booksReadCount}</Text><Text style={titleStyle}>本小说</Text>
    <Text style={bodyStyle}>{annualBooksSentence(summary)}</Text>
    <BookRow books={[summary.firstBook, summary.lastBook].filter((book, index, items): book is AnnualSummaryBook => Boolean(book) && items.findIndex(item => item?.bookId === book?.bookId) === index)} onOpenBook={onOpenBook} />
  </ScrollView>;

  if (page.id === 'months') return <ScrollView style={pageStyle} contentContainerStyle={styles.content}>
    <Text style={titleStyle}>阅读月份轨迹</Text><Text style={bodyStyle}>{peakMonthSentence(summary)}</Text><MonthChart summary={summary} />
    <BookRow books={summary.months.filter(month => summary.peakMonths.includes(month.month)).flatMap(month => month.books).slice(0, 3)} onOpenBook={onOpenBook} />
  </ScrollView>;

  if (page.id === 'preference') return <ScrollView style={pageStyle} contentContainerStyle={styles.content}>
    <Text style={titleStyle}>这一年的故事偏好</Text>
    {summary.topTags.length ? <><Text style={bodyStyle}>你最常走进这些故事</Text><View style={styles.chips}>{summary.topTags.map(tag => <Text key={tag.key} style={[styles.chip, { color: theme.primary, backgroundColor: theme.primarySoft }]}>{tag.label} · {tag.count}</Text>)}</View></> : null}
    {summary.topBookTypes.length ? <Text style={bodyStyle}>最常读的作品类型：{summary.topBookTypes.map(item => item.label).join('、')}</Text> : null}
    {summary.topAuthors.length ? <Text style={bodyStyle}>今年也常读：{summary.topAuthors.map(item => `${item.label}（${item.count} 本）`).join('、')}</Text> : null}
  </ScrollView>;

  if (page.id === 'rating') return <ScrollView style={pageStyle} contentContainerStyle={styles.content}>
    <Text style={titleStyle}>{summary.highestRatingHalfStars === 10 ? '五星故事' : '当前评分最高的故事'}</Text>
    <Text style={bodyStyle}>按当前保存的评分整理{summary.fiveStarBookCount ? ` · 共 ${summary.fiveStarBookCount} 本五星书` : ''}</Text>
    <BookRow books={summary.topRatedBooks} onOpenBook={onOpenBook} showRating />
  </ScrollView>;

  if (page.id === 'archive') return <ScrollView style={pageStyle} contentContainerStyle={styles.content}>
    <Text style={titleStyle}>留下的想法与片段</Text>
    <View style={styles.statsRow}><View style={[styles.statCard, { backgroundColor: theme.card }]}><Text style={[styles.statNumber, { color: theme.primary }]}>{summary.thoughtCount}</Text><Text style={bodyStyle}>条想法</Text></View><View style={[styles.statCard, { backgroundColor: theme.card }]}><Text style={[styles.statNumber, { color: theme.primary }]}>{summary.thoughtImageCount}</Text><Text style={bodyStyle}>张想法图片</Text></View></View>
    <Text style={bodyStyle}>当年读完的这些书，目前共保存了 {summary.currentHighlightCount} 张精彩片段。</Text>
  </ScrollView>;

  if (page.id === 'reread') return <ScrollView style={pageStyle} contentContainerStyle={styles.content}>
    <Text style={titleStyle}>有些故事，读一次是不够的</Text>
    {summary.rereadBooks.map(book => <Pressable accessibilityRole="button" key={book.bookId} onPress={() => onOpenBook(book.bookId)} style={[styles.listCard, { backgroundColor: theme.card }]}><Text style={[styles.listTitle, { color: theme.text }]}>{book.title}</Text><Text style={bodyStyle}>这一年再次读完 {book.rereadCompletionCount} 次</Text></Pressable>)}
  </ScrollView>;

  if (page.id === 'representative') return <ScrollView style={pageStyle} contentContainerStyle={styles.content}>
    <Text style={titleStyle}>年度代表故事</Text><Text style={bodyStyle}>按当前评分和你留下的记录整理</Text>
    <BookRow books={summary.representativeBooks} onOpenBook={onOpenBook} showRating />
    {summary.representativeBooks[0] ? <Text style={bodyStyle}>如果要从这一年留下一个故事，也许会是《{summary.representativeBooks[0].title}》。</Text> : null}
  </ScrollView>;

  return <ScrollView style={pageStyle} contentContainerStyle={styles.shareContent}>
    <AnnualSummarySharePanel summary={summary} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24, gap: 18 },
  shareContent: { paddingHorizontal: 20, paddingVertical: 20 },
  coverHero: { flex: 1, margin: 20, borderRadius: 30, padding: 28, justifyContent: 'center', gap: 14, overflow: 'hidden' },
  eyebrow: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', letterSpacing: 3 },
  coverTitle: { color: '#FFFFFF', fontSize: 38, lineHeight: 48, fontWeight: '900' },
  coverSubtitle: { color: '#FFFFFF', opacity: 0.85, fontSize: 17, lineHeight: 25 },
  coverCollage: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 20 },
  title: { fontSize: 28, lineHeight: 38, fontWeight: '900' },
  bigNumber: { fontSize: 88, lineHeight: 96, fontWeight: '900' },
  body: { fontSize: 16, lineHeight: 25 },
  bookRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  bookTile: { width: 82, gap: 5 },
  bookName: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  rating: { fontSize: 12, fontWeight: '700' },
  monthChart: { height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  monthColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  monthBar: { width: '70%', minHeight: 18, borderRadius: 6 },
  monthLabel: { fontSize: 10 },
  monthCount: { fontSize: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { fontSize: 16, fontWeight: '800', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, padding: 18, borderRadius: 20, gap: 5 },
  statNumber: { fontSize: 36, fontWeight: '900' },
  listCard: { padding: 18, borderRadius: 18, gap: 5 },
  listTitle: { fontSize: 18, fontWeight: '800' },
});
