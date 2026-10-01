import { router } from 'expo-router';
import { AddBookForm } from '../../books/AddBookForm';
import { useEffect, useState } from 'react';
import type { Tag } from '../../books/types';
import { useBooks, useTags } from '../../storage/AppProvider';

export default function NewBook() {
  const repo = useBooks();
  const tagRepo = useTags();
  const [quickTags, setQuickTags] = useState<Tag[]>([]);
  useEffect(() => {
    let active = true;
    tagRepo.listQuick().then(tags => { if (active) setQuickTags(tags); });
    return () => { active = false; };
  }, [tagRepo]);
  return <AddBookForm quickTags={quickTags} onSave={async input => { await repo.create(input); router.back(); }} />;
}
