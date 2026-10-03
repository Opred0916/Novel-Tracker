import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ReadingHistoryForm } from '../../../../books/ReadingHistoryForm';
import type { Book, ReadingSession } from '../../../../books/types';
import { useBooks, useReadingHistory } from '../../../../storage/AppProvider';

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

export default function ReadingHistoryPage() {
  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const books = useBooks();
  const history = useReadingHistory();
  const [book, setBook] = useState<Book | null>(null);
  const [session, setSession] = useState<ReadingSession | undefined>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoadState('loading');
    if (typeof id !== 'string' || !id || typeof sessionId !== 'string' || !sessionId) {
      setLoadState('missing');
      return () => { active = false; };
    }
    Promise.all([books.get(id), history.list(id)]).then(([result, records]) => {
      if (!active) return;
      setBook(result);
      const selected = records.find(record => record.id === sessionId);
      setSession(selected);
      setLoadState(result && (sessionId === 'first' ? result.legacyReadCount === 1 : Boolean(selected)) ? 'ready' : 'missing');
    }).catch(() => { if (active) setLoadState('error'); });
    return () => { active = false; };
  // `retry` intentionally invalidates this focus callback to trigger a fresh read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessionId, books, history, retry]));

  if (loadState === 'loading') return <View style={styles.center}><ActivityIndicator /></View>;
  if (loadState === 'missing') return <View style={styles.center}>
    <Text style={styles.message}>找不到这次阅读</Text>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.link}>返回</Text></Pressable>
  </View>;
  if (loadState === 'error') return <View style={styles.center}>
    <Text style={styles.message}>读取阅读记录失败，请重试</Text>
    <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={styles.link}>重试</Text></Pressable>
  </View>;
  if (!book || typeof id !== 'string' || typeof sessionId !== 'string') return null;

  return <ReadingHistoryForm key={sessionId} session={session} legacy={sessionId === 'first'}
    onSave={async (start, end) => {
      if (sessionId === 'first') {
        if (!start || !end) throw new Error('补记首刷日期需要完整日期');
        await history.backfillFirst(id, start, end);
      }
      else if (start === null || session?.startedOn === null) await history.updateHistoricalDates(id, sessionId, start, end);
      else await history.updateDates(id, sessionId, start, end);
      router.back();
    }}
    onDelete={sessionId === 'first' ? undefined : async () => {
      await history.delete(id, sessionId);
      router.back();
    }} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 24 },
  message: { fontSize: 17, color: '#302a25' },
  link: { fontSize: 16, color: '#593f72', fontWeight: '600' },
});
