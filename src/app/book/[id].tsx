import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookDetail } from '../../books/BookDetail';
import type { Book, ImageAsset, ReadingSession } from '../../books/types';
import { useBooks, useNotes, useReadingHistory } from '../../storage/AppProvider';
import { NotesSection } from '../../books/NotesSection';
import { HighlightsSection } from '../../books/HighlightsSection';

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

export default function BookPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const repo = useBooks();
  const historyRepo = useReadingHistory();
  const notesRepo = useNotes();
  const [book, setBook] = useState<Book | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [highlights, setHighlights] = useState<ImageAsset[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoadState('loading');
    if (typeof id !== 'string' || !id) {
      setLoadState('missing');
      return () => { active = false; };
    }
    Promise.all([repo.get(id), historyRepo.list(id), notesRepo.listHighlights(id)]).then(([result, records, images]) => {
      if (!active) return;
      setBook(result);
      setSessions(records);
      setHighlights(images);
      setLoadState(result ? 'ready' : 'missing');
    }).catch(() => { if (active) setLoadState('error'); });
    return () => { active = false; };
  // `retry` intentionally invalidates this focus callback to trigger a fresh read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, repo, historyRepo, notesRepo, retry]));

  if (loadState === 'loading') return <View style={styles.center}><ActivityIndicator /></View>;
  if (loadState === 'missing') return <View style={styles.center}>
    <Text style={styles.message}>找不到这本小说</Text>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={styles.link}>返回书架</Text></Pressable>
  </View>;
  if (loadState === 'error') return <View style={styles.center}>
    <Text style={styles.message}>读取小说失败，请重试</Text>
    <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={styles.link}>重试</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={styles.link}>返回书架</Text></Pressable>
  </View>;
  if (!book) return null;

  return <ScrollView testID="book-detail-scroll" style={styles.page} contentContainerStyle={styles.content}>
    <BookDetail book={book} sessions={sessions} onEditReading={sessionId => router.push({
      pathname: '/book/[id]/reading/[sessionId]', params: { id, sessionId },
    })} />
    <NotesSection bookId={id} repository={notesRepo} highlights={highlights} onChanged={() => setRetry(value => value + 1)} />
    <HighlightsSection bookId={id} repository={notesRepo} onChanged={() => setRetry(value => value + 1)} />
    <Pressable accessibilityRole="button" style={styles.edit} onPress={() => router.push({ pathname: '/book/[id]/edit', params: { id } })}>
      <Text style={styles.editText}>编辑资料</Text>
    </Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 24 },
  message: { fontSize: 17, color: '#302a25' },
  link: { fontSize: 16, color: '#593f72', fontWeight: '600' },
  edit: { backgroundColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center', marginHorizontal: 24, marginTop: 8 },
  editText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
