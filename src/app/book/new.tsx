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
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    tagRepo.listQuick().then(tags => { if (active) setQuickTags(tags); })
      .catch(() => { if (active) setError('快捷标签读取失败'); });
    return () => { active = false; };
  }, [tagRepo]);
  return <View style={{ flex: 1 }}>
    {error ? <Text style={{ color: '#b52626', marginHorizontal: 24 }}>{error}</Text> : null}
    <AddBookForm quickTags={quickTags} onSave={async input => { await repo.create(input); router.back(); }} />
  </View>;
}
