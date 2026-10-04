import { getDefaultCoverStyle } from '../../src/books/defaultCover';

test('chooses a stable paper palette from the book id', () => {
  expect(getDefaultCoverStyle('book-1')).toEqual(getDefaultCoverStyle('book-1'));
  const colors = new Set(['book-1', 'book-2', 'book-3', 'book-4', 'book-5'].map(id => getDefaultCoverStyle(id).backgroundColor));
  expect(colors.size).toBeGreaterThanOrEqual(2);
});
