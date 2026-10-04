import type { Book } from '../../src/books/types';
import { selectWantToReadBook } from '../../src/books/randomWantToRead';

const book = (id: string, status: Book['status'] = 'want_to_read'): Book => ({
  id, title: id, author: null, status, protagonists: [], ratingHalfStars: null, bookType: null, tags: [],
  legacyReadCount: 0, coverImageId: null, coverUri: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  whyWantToRead: null, platform: null,
});

test('selects only want-to-read books from the full list', () => {
  const result = selectWantToReadBook([book('reading', 'reading'), book('a'), book('finished', 'finished'), book('b')], null, () => 0.75);
  expect(result?.id).toBe('b');
});

test('avoids the previous pick when another candidate exists', () => {
  const result = selectWantToReadBook([book('a'), book('b')], 'a', () => 0);
  expect(result?.id).toBe('b');
});

test('returns null when there are no want-to-read books', () => {
  expect(selectWantToReadBook([book('reading', 'reading')], null, () => 0)).toBeNull();
});
