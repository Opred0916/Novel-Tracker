import { router } from 'expo-router';
import { AddBookForm } from '../../books/AddBookForm';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { Tag } from '../../books/types';
import { suggestionHistory, type SuggestionKind } from '../../books/suggestionHistory';
import { useBooks, useTags } from '../../storage/AppProvider';

export default function NewBook() {
  const repo = useBooks();
  const tagRepo = useTags();
  const [quickTags, setQuickTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
  const [platformSuggestions, setPlatformSuggestions] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([tagRepo.listQuick(), tagRepo.list(), repo.list()]).then(async ([quick, all, existing]) => {
      const [authors, platforms] = await Promise.all([
        suggestionHistory.list('author', existing.map(book => book.author ?? '')),
        suggestionHistory.list('platform', existing.map(book => book.platform ?? '')),
      ]);
      if (active) { setQuickTags(quick); setAllTags(all); setAuthorSuggestions(authors); setPlatformSuggestions(platforms); }
    })
      .catch(() => { if (active) setError('快捷标签读取失败'); });
    return () => { active = false; };
  }, [repo, tagRepo]);
  async function removeSuggestion(kind: SuggestionKind, value: string) {
    try {
      await suggestionHistory.remove(kind, value);
      (kind === 'author' ? setAuthorSuggestions : setPlatformSuggestions)(current => current.filter(item => item !== value));
    } catch { setError('删除输入记录失败，请重试'); }
  }
  return <View style={{ flex: 1 }}>
    {error ? <Text style={{ color: '#b52626', marginHorizontal: 24 }}>{error}</Text> : null}
    <AddBookForm quickTags={quickTags} allTags={allTags} authorSuggestions={authorSuggestions} platformSuggestions={platformSuggestions}
      onRemoveAuthorSuggestion={value => { void removeSuggestion('author', value); }} onRemovePlatformSuggestion={value => { void removeSuggestion('platform', value); }}
      onSave={async input => { await repo.create(input); await Promise.allSettled([suggestionHistory.remember('author', input.author ?? ''), suggestionHistory.remember('platform', input.platform ?? '')]); router.back(); }} />
  </View>;
}
