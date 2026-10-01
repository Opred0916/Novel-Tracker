import type { Book, BookStatus, BookType } from './types';

export type BookFilters = {
  query: string;
  status: BookStatus | null;
  bookType: BookType | null;
  tagIds: string[];
};

export function filterBooks(books: Book[], filters: BookFilters): Book[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return books.filter(book => {
    if (filters.status !== null && book.status !== filters.status) return false;
    if (filters.bookType !== null && book.bookType !== filters.bookType) return false;
    if (!filters.tagIds.every(id => book.tags.some(tag => tag.id === id))) return false;
    if (!query) return true;
    return [book.title, book.author ?? '', ...book.protagonists]
      .some(value => value.toLocaleLowerCase().includes(query));
  });
}
