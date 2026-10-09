import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookEditForm } from '../../../books/BookEditForm';
import { suggestionHistory, type SuggestionKind } from '../../../books/suggestionHistory';
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
  const [quickTags, setQuickTags] = useState<Tag[]>([]);
  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
  const [platformSuggestions, setPlatformSuggestions] = useState<string[]>([]);
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
    Promise.all([repo.get(id), tagRepo.list(), tagRepo.listQuick(), historyRepo.list(id), repo.list()]).then(async ([result, tags, quick, records, books]) => {
      const [authors, platforms] = await Promise.all([
        suggestionHistory.list('author', books.map(item => item.author ?? '')),
        suggestionHistory.list('platform', books.map(item => item.platform ?? '')),
      ]);
      if (!active) return;
      setBook(result);
      setAllTags(tags);
      setQuickTags(quick);
      setSessions(records);
      setAuthorSuggestions(authors);
      setPlatformSuggestions(platforms);
      setLoadState(result ? 'ready' : 'missing');
    }).catch(() => { if (active) setLoadState('error'); });
    return () => { active = false; };
  // `retry` intentionally invalidates this focus callback to trigger a fresh read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, repo, tagRepo, historyRepo, retry]));

  async function removeSuggestion(kind: SuggestionKind, value: string) {
    try {
      await suggestionHistory.remove(kind, value);
      (kind === 'author' ? setAuthorSuggestions : setPlatformSuggestions)(current => current.filter(item => item !== value));
    } catch { /* Leave the record visible if storage is unavailable. */ }
  }

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

  return <BookEditForm book={book} allTags={allTags} quickTags={quickTags} authorSuggestions={authorSuggestions} platformSuggestions={platformSuggestions}
    onRemoveAuthorSuggestion={value => { void removeSuggestion('author', value); }} onRemovePlatformSuggestion={value => { void removeSuggestion('platform', value); }} sessions={sessions} onSave={async input => {
    await repo.update(id, input);
    await Promise.allSettled([suggestionHistory.remember('author', input.author ?? ''), suggestionHistory.remember('platform', input.platform ?? '')]);
    router.back();
  }} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 24 },
  message: { fontSize: 17, color: '#302a25' },
  link: { fontSize: 16, color: '#28584E', fontWeight: '600' },
});
