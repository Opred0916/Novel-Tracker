import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
  const currentBook = book;

  async function deleteBook() {
    setDeleting(true);
    setDeleteError('');
    try {
      await repo.delete(id);
      router.replace('/');
    } catch {
      setDeleting(false);
      setDeleteError('删除失败，请重试');
    }
  }

  function confirmDelete() {
    if (deleting) return;
    Alert.alert('删除小说', `确定要删除《${currentBook.title}》以及它的阅读记录、摘记、精彩片段和封面吗？删除后无法在应用内撤销。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除小说', style: 'destructive', onPress: () => { void deleteBook(); } },
    ]);
  }

  return <ScrollView testID="book-detail-scroll" style={styles.page} contentContainerStyle={styles.content}>
    <BookDetail book={currentBook} sessions={sessions} onEditReading={sessionId => router.push({
      pathname: '/book/[id]/reading/[sessionId]', params: { id, sessionId },
    })} />
    <NotesSection bookId={id} repository={notesRepo} highlights={highlights} onChanged={() => setRetry(value => value + 1)} />
    <HighlightsSection bookId={id} repository={notesRepo} onChanged={() => setRetry(value => value + 1)} />
    <Pressable accessibilityRole="button" disabled={deleting} style={[styles.edit, deleting && styles.disabled]} onPress={() => router.push({ pathname: '/book/[id]/edit', params: { id } })}>
      <Text style={styles.editText}>编辑资料</Text>
    </Pressable>
    {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
    <Pressable accessibilityRole="button" disabled={deleting} style={[styles.delete, deleting && styles.disabled]} onPress={confirmDelete}>
      <Text style={styles.deleteText}>{deleting ? '正在删除…' : '删除小说'}</Text>
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
  delete: { borderWidth: 1, borderColor: '#b52626', padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 24, marginTop: 12 },
  deleteText: { color: '#b52626', fontWeight: '700', fontSize: 16 },
  deleteError: { color: '#b52626', textAlign: 'center', marginHorizontal: 24, marginTop: 14 },
  disabled: { opacity: 0.55 },
});
