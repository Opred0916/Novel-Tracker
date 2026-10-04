import type { BookSearchResult } from '../../src/books/bookSearch';
import type { Book } from '../../src/books/types';
import { isValidFinishedDate, sortBookSearchResults } from '../../src/books/bookSearchSort';

function result(id: string, overrides: Partial<Book> = {}): BookSearchResult {
  const book: Book = {
    id,
    title: id,
    author: null,
    status: 'want_to_read',
    protagonists: [],
    ratingHalfStars: null,
    bookType: null,
    tags: [],
    legacyReadCount: 0,
    coverImageId: null,
    coverUri: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    whyWantToRead: null,
    platform: null,
    ...overrides,
  };
  return { book, matchedNoteSnippet: null, matchedImage: null };
}

test('sorts by recent update, recent addition, and rating without mutating input', () => {
  const items = [
    result('old', { createdAt: '2026-01-03T00:00:00.000Z', updatedAt: '2026-01-03T00:00:00.000Z', ratingHalfStars: 9 }),
    result('new', { createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-05T00:00:00.000Z', ratingHalfStars: 10 }),
    result('middle', { createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '2026-01-04T00:00:00.000Z' }),
  ];
  const originalIds = items.map(item => item.book.id);

  expect(sortBookSearchResults(items, 'recently_updated', new Map()).map(item => item.book.id)).toEqual(['new', 'middle', 'old']);
  expect(sortBookSearchResults(items, 'recently_added', new Map()).map(item => item.book.id)).toEqual(['middle', 'old', 'new']);
  expect(sortBookSearchResults(items, 'rating_high', new Map()).map(item => item.book.id)).toEqual(['new', 'old', 'middle']);
  expect(items.map(item => item.book.id)).toEqual(originalIds);
});

test('sorts recent finished dates, puts missing dates last, and uses stable tie breakers', () => {
  const items = [
    result('same-old', { updatedAt: '2026-01-01T00:00:00.000Z' }),
    result('latest', { updatedAt: '2026-01-01T00:00:00.000Z' }),
    result('same-new', { updatedAt: '2026-01-02T00:00:00.000Z' }),
    result('missing', { updatedAt: '2026-01-03T00:00:00.000Z' }),
  ];
  const finishedDates = new Map([
    ['same-old', '2026-10-02'],
    ['latest', '2026-10-03'],
    ['same-new', '2026-10-02'],
  ]);

  expect(sortBookSearchResults(items, 'recently_finished', finishedDates).map(item => item.book.id)).toEqual(['latest', 'same-new', 'same-old', 'missing']);
});

test('validates finished dates as real four digit calendar dates', () => {
  expect(isValidFinishedDate('2026-02-28')).toBe(true);
  expect(isValidFinishedDate('2026-02-30')).toBe(false);
  expect(isValidFinishedDate(null)).toBe(false);
  expect(isValidFinishedDate('2026-2-02')).toBe(false);
});
