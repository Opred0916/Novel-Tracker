import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Book } from '../books/types';
import { BookCard } from '../books/BookCard';
import { useBooks } from '../storage/AppProvider';

export default function Bookshelf() {
  const repo = useBooks();
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    repo.list().then(items => { if (active) setBooks(items); }).catch(() => { if (active) setError('读取书架失败'); });
    return () => { active = false; };
  }, [repo]));

  return <View style={styles.page}>
    <Text style={styles.heading}>把喜欢的故事留在这里</Text>
    <Text style={styles.subheading}>想读 · 在读 · 读完 · 弃读</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <FlatList data={books} keyExtractor={item => item.id} contentContainerStyle={styles.list}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>书架还是空的</Text><Text style={styles.subheading}>先记下一本想读的小说吧。</Text></View>}
      renderItem={({ item }) => <BookCard book={item} onPress={() => router.push({ pathname: '/book/[id]', params: { id: item.id } })} />}
    />
    <Link href="/book/new" asChild><Pressable accessibilityRole="button" style={styles.add}><Text style={styles.addText}>＋ 添加小说</Text></Pressable></Link>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 22 }, heading: { fontSize: 26, fontWeight: '700', color: '#302a25', marginTop: 10 },
  subheading: { color: '#817871', marginTop: 8 }, error: { color: '#b52626' }, list: { flexGrow: 1, paddingTop: 22, paddingBottom: 20 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' }, emptyTitle: { fontSize: 20, fontWeight: '600', color: '#302a25' },
  add: { backgroundColor: '#593f72', padding: 18, borderRadius: 16, alignItems: 'center' }, addText: { color: 'white', fontWeight: '700', fontSize: 17 },
});
