import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { filterBooks } from '../books/bookFilters';
import { TagPicker } from '../books/TagPicker';
import { BOOK_TYPE_LABELS } from '../books/TypePicker';
import { BOOK_STATUSES, BOOK_TYPES, type Book, type BookStatus, type BookType, type Tag } from '../books/types';
import { BookCard } from '../books/BookCard';
import { BOOK_STATUS_LABELS } from '../books/status';
import { useBooks, useTags } from '../storage/AppProvider';

export default function Bookshelf() {
  const repo = useBooks();
  const tagRepo = useTags();
  const [books, setBooks] = useState<Book[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BookStatus | null>(null);
  const [bookType, setBookType] = useState<BookType | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    repo.list().then(items => { if (active) setBooks(items); }).catch(() => { if (active) setError('读取书架失败'); });
    tagRepo.list().then(items => { if (active) setTags(items); }).catch(() => { if (active) setError('读取标签失败'); });
    return () => { active = false; };
  }, [repo, tagRepo]));

  const shown = filterBooks(books, { query, status, bookType, tagIds });

  function clearFilters() {
    setQuery('');
    setStatus(null);
    setBookType(null);
    setTagIds([]);
  }

  return <View style={styles.page}>
    <Text style={styles.heading}>把喜欢的故事留在这里</Text>
    <Text style={styles.subheading}>想读 · 在读 · 读完 · 弃读</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <TextInput placeholder="搜索书名、作者或主角" value={query} onChangeText={setQuery} style={styles.search} />
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={() => setShowFilters(value => !value)}><Text style={styles.link}>筛选条件</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={clearFilters}><Text style={styles.link}>清除筛选</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/settings/tags')}><Text style={styles.link}>快捷标签设置</Text></Pressable>
    </View>
    <FlatList data={shown} keyExtractor={item => item.id} contentContainerStyle={styles.list}
      ListHeaderComponent={showFilters ? <View style={styles.filters}>
        <Text style={styles.filterTitle}>阅读状态</Text>
        <View style={styles.chips}>{[null, ...BOOK_STATUSES].map(value => <Pressable key={value ?? 'all'}
          accessibilityRole="radio" accessibilityState={{ checked: status === value }} onPress={() => setStatus(value)}
          style={[styles.chip, status === value && styles.chipSelected]}>
          <Text style={[styles.chipText, status === value && styles.chipSelectedText]}>{value === null ? '全部状态' : BOOK_STATUS_LABELS[value]}</Text>
        </Pressable>)}</View>
        <Text style={styles.filterTitle}>作品类型</Text>
        <View style={styles.chips}>{[null, ...BOOK_TYPES].map(value => <Pressable key={value ?? 'all'}
          accessibilityRole="radio" accessibilityState={{ checked: bookType === value }} onPress={() => setBookType(value)}
          style={[styles.chip, bookType === value && styles.chipSelected]}>
          <Text style={[styles.chipText, bookType === value && styles.chipSelectedText]}>{value === null ? '全部类型' : BOOK_TYPE_LABELS[value]}</Text>
        </Pressable>)}</View>
        <Text style={styles.filterTitle}>标签（可多选）</Text>
        <TagPicker tags={tags} selectedIds={tagIds} onChange={setTagIds} searchable />
      </View> : null}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>{books.length ? '没有符合条件的小说' : '书架还是空的'}</Text><Text style={styles.subheading}>{books.length ? '试试清除筛选。' : '先记下一本想读的小说吧。'}</Text></View>}
      renderItem={({ item }) => <BookCard book={item} onPress={() => router.push({ pathname: '/book/[id]', params: { id: item.id } })} />}
    />
    <Link href="/book/new" asChild><Pressable accessibilityRole="button" style={styles.add}><Text style={styles.addText}>＋ 添加小说</Text></Pressable></Link>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 22 }, heading: { fontSize: 26, fontWeight: '700', color: '#302a25', marginTop: 10 },
  subheading: { color: '#817871', marginTop: 8 }, error: { color: '#b52626' }, list: { flexGrow: 1, paddingTop: 22, paddingBottom: 20 },
  search: { marginTop: 14, borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, backgroundColor: '#fff', padding: 12, fontSize: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }, link: { color: '#593f72', fontWeight: '600' },
  filters: { gap: 10, paddingBottom: 20 }, filterTitle: { color: '#302a25', fontWeight: '600', marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  chipSelected: { backgroundColor: '#593f72', borderColor: '#593f72' }, chipText: { color: '#302a25' }, chipSelectedText: { color: '#fff', fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' }, emptyTitle: { fontSize: 20, fontWeight: '600', color: '#302a25' },
  add: { backgroundColor: '#593f72', padding: 18, borderRadius: 16, alignItems: 'center' }, addText: { color: 'white', fontWeight: '700', fontSize: 17 },
});
