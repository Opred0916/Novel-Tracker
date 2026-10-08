import React, { forwardRef, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getDefaultCoverStyle } from './defaultCover';
import type { AnnualSummarySnapshot } from './annualSummarySnapshot';

type LoadState = { snapshot: AnnualSummarySnapshot; ready: Set<string>; failed: Set<string> };

export const AnnualSummaryPoster = forwardRef<View, { snapshot: AnnualSummarySnapshot; onReady(ready: boolean): void }>(function AnnualSummaryPoster({ snapshot, onReady }, ref) {
  const [load, setLoad] = useState<LoadState>(() => ({ snapshot, ready: new Set(), failed: new Set() }));
  if (load.snapshot !== snapshot) setLoad({ snapshot, ready: new Set(), failed: new Set() });
  const current = load.snapshot === snapshot ? load : { snapshot, ready: new Set<string>(), failed: new Set<string>() };
  const ready = snapshot.books.every(book => !book.coverUri || current.ready.has(book.bookId));
  useEffect(() => { onReady(ready); }, [onReady, ready, snapshot]);

  function mark(bookId: string, failed: boolean) {
    setLoad(previous => {
      if (previous.snapshot !== snapshot) return previous;
      const nextReady = new Set(previous.ready); nextReady.add(bookId);
      const nextFailed = new Set(previous.failed); if (failed) nextFailed.add(bookId);
      return { snapshot, ready: nextReady, failed: nextFailed };
    });
  }

  const c = snapshot.colors;
  return <View ref={ref} collapsable={false} style={[styles.poster, { backgroundColor: c.background }]}>
    <View style={[styles.hero, { backgroundColor: c.primary }]}>
      <Text style={[styles.kicker, { color: c.card }]}>我的 {snapshot.year} 阅读回顾</Text>
      <Text style={[styles.headline, { color: c.card }]}>今年读完 {snapshot.booksReadCount} 本小说</Text>
      <Text style={[styles.subheading, { color: c.primarySoft }]}>这一年，我把喜欢的故事留了下来</Text>
    </View>
    <View style={styles.body}>
      {snapshot.tags.length ? <View style={styles.tags}>{snapshot.tags.map(tag => <Text key={tag} style={[styles.tag, { color: c.primary, backgroundColor: c.primarySoft }]}>{tag}</Text>)}</View> : null}
      <View style={styles.books}>{snapshot.books.map((book, index) => {
        const palette = getDefaultCoverStyle(book.bookId);
        const imageVisible = snapshot.privacy.showCovers && book.coverUri && !current.failed.has(book.bookId);
        return <View key={book.bookId} style={styles.book}>
          {imageVisible ? <Image accessibilityLabel={`${book.title}封面`} source={{ uri: book.coverUri! }} style={styles.cover} onLoadEnd={() => mark(book.bookId, false)} onError={() => mark(book.bookId, true)} />
            : snapshot.privacy.showCovers ? <View accessibilityLabel={`${book.title}默认封面`} style={[styles.cover, styles.defaultCover, { backgroundColor: palette.backgroundColor, borderColor: palette.accentColor }]}>{snapshot.privacy.showTitles ? <Text numberOfLines={3} style={[styles.defaultTitle, { color: palette.accentColor }]}>{book.title}</Text> : null}</View>
              : <View accessibilityLabel="隐藏封面的抽象书脊" style={[styles.cover, styles.abstractCover, { backgroundColor: index % 2 ? c.primarySoft : c.card, borderColor: c.primary }]}><View style={[styles.spineLine, { backgroundColor: c.primary }]} /></View>}
          {snapshot.privacy.showTitles ? <Text accessibilityLabel={book.title} numberOfLines={3} style={[styles.bookTitle, { color: c.text }]}>{book.title}</Text> : null}
        </View>;
      })}</View>
      {snapshot.privacy.showArchiveStats ? <View style={[styles.archive, { borderColor: c.border, backgroundColor: c.card }]}>
        <Text style={[styles.archiveText, { color: c.text }]}>{snapshot.thoughtCount ?? 0} 条想法</Text>
        <View style={[styles.divider, { backgroundColor: c.border }]} />
        <Text style={[styles.archiveText, { color: c.text }]}>{snapshot.currentHighlightCount ?? 0} 张精彩片段</Text>
      </View> : null}
      <Text style={[styles.brand, { color: c.mutedText }]}>由 Novel Tracker 记录</Text>
    </View>
  </View>;
});

const styles = StyleSheet.create({
  poster: { width: 360, minHeight: 640, borderRadius: 24, overflow: 'hidden' },
  hero: { paddingHorizontal: 25, paddingVertical: 28, gap: 9 },
  kicker: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  headline: { fontSize: 31, lineHeight: 41, fontWeight: '900' },
  subheading: { fontSize: 13, lineHeight: 20 },
  body: { padding: 20, gap: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, fontSize: 12, fontWeight: '800' },
  books: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  book: { width: 92, alignItems: 'center', gap: 7 },
  cover: { width: 76, height: 106, borderRadius: 9, overflow: 'hidden' },
  defaultCover: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, padding: 6 },
  defaultTitle: { fontSize: 12, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
  abstractCover: { borderWidth: 1, justifyContent: 'center', paddingHorizontal: 14 },
  spineLine: { width: 4, height: 70, borderRadius: 2, opacity: 0.45 },
  bookTitle: { width: 92, minHeight: 34, fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  archive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 16, paddingVertical: 14, gap: 13 },
  archiveText: { fontSize: 13, fontWeight: '800' },
  divider: { width: 1, height: 18 },
  brand: { textAlign: 'center', fontSize: 11, letterSpacing: 0.8, marginTop: 2 },
});
