import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookEditForm } from '../../../books/BookEditForm';
import type { Book, ReadingSession, Tag } from '../../../books/types';
import { useBooks, useReadingHistory, useTags } from '../../../storage/AppProvider';
import { useTheme } from '../../../theme/ThemeProvider';

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

export default function EditBookPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const repo = useBooks();
  const tagRepo = useTags();
  const historyRepo = useReadingHistory();
  const [book, setBook] = useState<Book | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoadState('loading');
    if (typeof id !== 'string' || !id) {
      setLoadState('missing');
      return () => { active = false; };
    }
    Promise.all([repo.get(id), tagRepo.list(), historyRepo.list(id)]).then(([result, tags, records]) => {
      if (!active) return;
      setBook(result);
      setAllTags(tags);
      setSessions(records);
      setLoadState(result ? 'ready' : 'missing');
    }).catch(() => { if (active) setLoadState('error'); });
    return () => { active = false; };
  // `retry` intentionally invalidates this focus callback to trigger a fresh read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, repo, tagRepo, historyRepo, retry]));

  if (loadState === 'loading') return <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>;
  if (loadState === 'missing') return <View style={styles.center}>
    <Text style={[styles.message, { color: theme.text }]}>找不到这本小说</Text>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={[styles.link, { color: theme.primary }]}>返回书架</Text></Pressable>
  </View>;
  if (loadState === 'error') return <View style={styles.center}>
    <Text style={[styles.message, { color: theme.text }]}>读取小说失败，请重试</Text>
    <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={[styles.link, { color: theme.primary }]}>重试</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={[styles.link, { color: theme.primary }]}>返回书架</Text></Pressable>
  </View>;
  if (!book) return null;

  return <BookEditForm book={book} allTags={allTags} sessions={sessions} onSave={async input => {
    await repo.update(id, input);
    router.back();
  }} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 24 },
  message: { fontSize: 17, color: '#302a25' },
  link: { fontSize: 16, color: '#28584E', fontWeight: '600' },
});
