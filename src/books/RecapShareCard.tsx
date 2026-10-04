import React, { forwardRef, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getDefaultCoverStyle } from './defaultCover';
import type { RecapShareSnapshot } from './recapShareSnapshot';

type LoadState = { snapshot: RecapShareSnapshot; ready: Set<string>; failed: Set<string> };

export const RecapShareCard = forwardRef<View, { snapshot: RecapShareSnapshot; onReady(ready: boolean): void }>(function RecapShareCard({ snapshot, onReady }, ref) {
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
  return <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: c.background }]}>
    <View style={[styles.top, { backgroundColor: c.primary }]}>
      <Text style={[styles.year, { color: c.card }]}>{snapshot.year} 年</Text>
      <Text style={[styles.heading, { color: c.card }]}>{snapshot.title}</Text>
      <Text style={[styles.description, { color: c.card }]}>{snapshot.description}</Text>
    </View>
    <View style={styles.body}>
      <Text style={[styles.count, { color: c.primary }]}>共 {snapshot.totalBooks} 本</Text>
      {snapshot.books.map(book => {
        const cover = getDefaultCoverStyle(book.bookId);
        const showImage = book.coverUri && !current.failed.has(book.bookId);
        return <View key={book.bookId} style={[styles.book, { backgroundColor: c.card, borderColor: c.border }]}>
          {showImage ? <Image accessibilityLabel={`${book.title}封面`} source={{ uri: book.coverUri! }} style={styles.cover} onLoadEnd={() => mark(book.bookId, false)} onError={() => mark(book.bookId, true)} />
            : <View accessibilityLabel={`${book.title}默认封面`} style={[styles.cover, styles.defaultCover, { backgroundColor: cover.backgroundColor }]}><Text numberOfLines={3} style={[styles.defaultTitle, { color: cover.accentColor }]}>{book.title}</Text></View>}
          <View style={styles.bookText}><Text numberOfLines={3} style={[styles.bookTitle, { color: c.text }]}>{book.title}</Text><Text style={[styles.date, { color: c.mutedText }]}>{book.endedOn}</Text></View>
        </View>;
      })}
      {snapshot.overflowCount > 0 ? <Text style={[styles.overflow, { color: c.primary }]}>另有 {snapshot.overflowCount} 本</Text> : null}
    </View>
  </View>;
});

const styles = StyleSheet.create({
  card: { width: 360, minHeight: 560, overflow: 'hidden', borderRadius: 20 },
  top: { padding: 26, gap: 10 }, year: { fontSize: 16, fontWeight: '700' }, heading: { fontSize: 30, fontWeight: '800' }, description: { fontSize: 14, lineHeight: 21 },
  body: { padding: 20, gap: 12 }, count: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  book: { flexDirection: 'row', gap: 14, borderWidth: 1, borderRadius: 14, padding: 10, minHeight: 92, alignItems: 'center' },
  cover: { width: 54, height: 72, borderRadius: 7 }, defaultCover: { alignItems: 'center', justifyContent: 'center', padding: 3 }, defaultTitle: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  bookText: { flex: 1, gap: 7 }, bookTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700' }, date: { fontSize: 12 }, overflow: { textAlign: 'center', fontSize: 14, fontWeight: '700', marginTop: 4 },
});
