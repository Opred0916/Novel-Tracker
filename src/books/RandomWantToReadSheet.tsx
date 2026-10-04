import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { Book } from './types';
import { BookCover } from './BookCover';

export type RandomWantToReadSheetProps = {
  book: Book | null;
  candidateCount: number;
  onOpen(id: string): void;
  onClose(): void;
  onPickAgain(): void;
};

export function RandomWantToReadSheet({ book, candidateCount, onOpen, onClose, onPickAgain }: RandomWantToReadSheetProps) {
  const { theme } = useTheme();
  return <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: theme.card }]}>
    <View style={styles.handle} />
    <View style={styles.headingRow}><Text style={[styles.title, { color: theme.text }]}>随机抽到</Text><Pressable accessibilityRole="button" onPress={onClose}><Text style={[styles.close, { color: theme.mutedText }]}>关闭</Text></Pressable></View>
    <Text style={[styles.count, { color: theme.mutedText }]}>候选书目 {candidateCount} 本</Text>
    {book ? <>
      <View style={styles.bookRow}><BookCover uri={book.coverUri} title={book.title} size="medium" /><View style={styles.bookInfo}><Text style={[styles.bookTitle, { color: theme.text }]}>{book.title}</Text>{book.author ? <Text style={[styles.meta, { color: theme.mutedText }]}>{book.author}</Text> : null}{book.protagonists.length ? <Text style={[styles.meta, { color: theme.mutedText }]}>主角：{book.protagonists.join('、')}</Text> : null}{book.whyWantToRead ? <Text style={[styles.reason, { color: theme.text }]}>想读理由：{book.whyWantToRead}</Text> : null}</View></View>
      <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => onOpen(book.id)} style={[styles.primary, { backgroundColor: theme.primary }]}><Text style={styles.primaryText}>查看小说</Text></Pressable><Pressable accessibilityRole="button" onPress={onPickAgain} style={[styles.secondary, { borderColor: theme.border }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>再抽一本</Text></Pressable></View>
    </> : <View style={styles.empty}><Text style={[styles.emptyTitle, { color: theme.text }]}>暂时没有想读的小说</Text><Text style={[styles.meta, { color: theme.mutedText }]}>先在书架里添加几本想读的小说吧。</Text></View>}
  </View>;
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, gap: 10 }, handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#B8B8B8', marginBottom: 4 }, headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 24, fontWeight: '800' }, close: { fontWeight: '600' }, count: { fontSize: 13 }, bookRow: { flexDirection: 'row', gap: 16, marginTop: 8 }, bookInfo: { flex: 1, gap: 8, justifyContent: 'center' }, bookTitle: { fontSize: 22, fontWeight: '800' }, meta: { fontSize: 14 }, reason: { marginTop: 4, lineHeight: 20 }, actions: { flexDirection: 'row', gap: 10, marginTop: 14 }, primary: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 14 }, primaryText: { color: '#fff', fontWeight: '800' }, secondary: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, borderWidth: 1 }, empty: { paddingVertical: 42, alignItems: 'center', gap: 8 }, emptyTitle: { fontSize: 19, fontWeight: '700' },
});
