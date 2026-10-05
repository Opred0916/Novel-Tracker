import { router } from 'expo-router';
import { AddBookForm } from '../../books/AddBookForm';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { Tag } from '../../books/types';
import { useBooks, useTags } from '../../storage/AppProvider';

export default function NewBook() {
  const repo = useBooks();
  const tagRepo = useTags();
  const [quickTags, setQuickTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [books, setBooks] = useState<{ author: string | null; platform: string | null }[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([tagRepo.listQuick(), tagRepo.list(), repo.list()]).then(([quick, all, existing]) => { if (active) { setQuickTags(quick); setAllTags(all); setBooks(existing); } })
      .catch(() => { if (active) setError('快捷标签读取失败'); });
    return () => { active = false; };
  }, [repo, tagRepo]);
  return <View style={{ flex: 1 }}>
    {error ? <Text style={{ color: '#b52626', marginHorizontal: 24 }}>{error}</Text> : null}
    <AddBookForm quickTags={quickTags} allTags={allTags} authorSuggestions={books.map(book => book.author ?? '')} platformSuggestions={books.map(book => book.platform ?? '')} onSave={async input => { await repo.create(input); router.back(); }} />
  </View>;
}
