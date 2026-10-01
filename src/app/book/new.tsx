import { router } from 'expo-router';
import { AddBookForm } from '../../books/AddBookForm';
import { useBooks } from '../../storage/AppProvider';

export default function NewBook() {
  const repo = useBooks();
  return <AddBookForm onSave={async input => { await repo.create(input); router.back(); }} />;
}
