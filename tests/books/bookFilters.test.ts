import { filterBooks, type BookFilters } from '../../src/books/bookFilters';
import type { Book } from '../../src/books/types';

const base: Book = {
  id: 'one', title: '长夜', author: '某作者', protagonists: ['阿青'], status: 'finished',
  ratingHalfStars: 9, bookType: 'romance_male_male',
  tags: [{ id: 'ancient', name: '古代', isSystem: true }, { id: 'suspense', name: '悬疑', isSystem: true }],
  createdAt: '2026-09-29', updatedAt: '2026-10-01',
};
const books: Book[] = [base, {
  ...base, id: 'two', title: '归途', author: '另一作者', protagonists: ['小林'],
  status: 'reading', bookType: 'other', tags: [{ id: 'ancient', name: '古代', isSystem: true }],
}];
const all: BookFilters = { query: '', status: null, bookType: null, tagIds: [] };

test('searches title, author and protagonist without changing book order', () => {
  for (const query of ['长夜', '某作者', '阿青']) {
    expect(filterBooks(books, { ...all, query }).map(book => book.id)).toEqual(['one']);
  }
  expect(filterBooks(books, { ...all, query: '  ' }).map(book => book.id)).toEqual(['one', 'two']);
});

test('combines status, work type and every selected tag', () => {
  expect(filterBooks(books, {
    query: '', status: 'finished', bookType: 'romance_male_male', tagIds: ['ancient', 'suspense'],
  }).map(book => book.id)).toEqual(['one']);
  expect(filterBooks(books, { ...all, tagIds: ['suspense'], bookType: 'other' })).toEqual([]);
  expect(filterBooks(books, { ...all }).map(book => book.id)).toEqual(['one', 'two']);
});
