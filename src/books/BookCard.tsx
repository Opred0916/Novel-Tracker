import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Book } from './types';
import type { BookSearchResult } from './bookSearch';
import { BookCover } from './BookCover';
import { useTheme } from '../theme/ThemeProvider';

export function BookCard({ book, matchedNoteSnippet, matchedImage, onPress, selection, onQuickRecord }: { book: Book; matchedNoteSnippet?: string | null; matchedImage?: BookSearchResult['matchedImage']; onPress: () => void; selection?: { checked: boolean; onToggle: () => void }; onQuickRecord?: () => void }) {
  const { theme } = useTheme();
  const isSelecting = Boolean(selection);
  return <View style={[styles.wrapper, { backgroundColor: theme.card }]}><Pressable accessibilityRole={isSelecting ? 'checkbox' : 'button'} accessibilityLabel={isSelecting ? `选择${book.title}` : `查看${book.title}`} accessibilityState={isSelecting ? { checked: selection?.checked } : undefined} onPress={isSelecting ? selection?.onToggle : onPress} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isSelecting && styles.selectionCard]}>
    {selection ? <Text style={[styles.checkbox, { borderColor: theme.border, backgroundColor: selection.checked ? theme.primary : 'transparent' }]}>{selection.checked ? '✓' : ''}</Text> : null}
    <BookCover title={book.title} bookId={book.id} uri={book.coverUri} size="small" />
    <View style={styles.details}>
      <Text style={[styles.title, { color: theme.text }]}>{book.title}</Text>
      {book.author ? <Text style={[styles.author, { color: theme.mutedText }]}>{book.author}</Text> : null}
      {matchedNoteSnippet ? <View style={styles.noteMatch}>
        <Text style={[styles.noteLabel, { color: theme.primary }]}>匹配摘记</Text>
        <Text style={[styles.noteSnippet, { color: theme.mutedText }]} numberOfLines={2}>{matchedNoteSnippet}</Text>
      </View> : null}
      {matchedImage ? <View style={styles.noteMatch}>
        <Text style={[styles.noteLabel, { color: theme.primary }]}>匹配图片文字</Text>
        <Text style={[styles.noteSnippet, { color: theme.mutedText }]} numberOfLines={2}>{matchedImage.snippet}</Text>
      </View> : null}
    </View>
    {book.ratingHalfStars !== null ? <Text style={[styles.rating, { color: theme.rating }]}>★ {(book.ratingHalfStars / 2).toFixed(1)}</Text> : null}
  </Pressable>{onQuickRecord && !isSelecting ? <Pressable accessibilityRole="button" accessibilityLabel={`快捷记录《${book.title}》`} onPress={onQuickRecord} style={({ pressed }) => [styles.quickAction, { backgroundColor: pressed ? theme.border : theme.primarySoft, borderColor: theme.border }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>快捷记录</Text></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12, borderRadius: 14 }, card: { backgroundColor: 'white', padding: 14, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, selectionCard: { borderWidth: 1, borderColor: '#d6cec4' },
  quickAction: { alignSelf: 'flex-end', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', marginRight: 12, marginBottom: 10 },
  checkbox: { width: 24, height: 24, borderWidth: 1, borderColor: '#b9afa5', borderRadius: 12, textAlign: 'center', lineHeight: 22, color: '#fff' }, checkboxChecked: { backgroundColor: '#28584E', borderColor: '#28584E' },
  details: { flex: 1, gap: 4 },
  title: { fontSize: 17, fontWeight: '600', color: '#302a25', flexShrink: 1 },
  author: { color: '#766f68' }, rating: { color: '#B77B24' },
  noteMatch: { marginTop: 6, gap: 2 },
  noteLabel: { color: '#B77B24', fontSize: 12, fontWeight: '700' },
  noteSnippet: { color: '#655e58', fontSize: 13, lineHeight: 19 },
});
