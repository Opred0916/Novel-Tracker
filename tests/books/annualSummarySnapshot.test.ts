import { makeAnnualSummarySnapshot, DEFAULT_ANNUAL_SUMMARY_PRIVACY } from '../../src/books/annualSummarySnapshot';
import type { AnnualStorySummary, AnnualSummaryBook } from '../../src/books/annualSummaryRepository';
import { THEMES } from '../../src/theme/theme';

function book(id: string, overrides: Partial<AnnualSummaryBook> = {}): AnnualSummaryBook {
  return {
    bookId: id, title: `书${id}`, author: `作者${id}`, coverUri: `file:///${id}.jpg`, bookType: null, tags: [], ratingHalfStars: 8,
    firstFinishedOn: `2026-${String(Number(id.replace(/\D/g, '')) || 1).padStart(2, '0')}-01`, lastFinishedOn: '2026-12-01',
    rereadCompletionCount: 0, annualThoughtCount: 0, annualThoughtImageCount: 0, currentHighlightCount: 0, ...overrides,
  };
}

function summary(overrides: Partial<AnnualStorySummary> = {}): AnnualStorySummary {
  const books = Array.from({ length: 7 }, (_, index) => book(String(index + 1)));
  return {
    year: 2026, booksReadCount: books.length, books, coverBooks: books.slice(0, 6), firstBook: books[0], lastBook: books.at(-1)!,
    months: [], peakMonths: [], topTags: [
      { key: 'a', label: '古代', count: 4 }, { key: 'b', label: '强强', count: 3 }, { key: 'c', label: '救赎', count: 2 }, { key: 'd', label: '日常', count: 2 },
    ], topBookTypes: [], topAuthors: [], highestRatingHalfStars: 10, topRatedBooks: [], fiveStarBookCount: 2,
    thoughtCount: 12, thoughtBookCount: 5, thoughtImageCount: 3, currentHighlightCount: 9, mostThoughtBooks: [], rereadBooks: [],
    representativeBooks: [books[6], books[0], books[3]], ...overrides,
  };
}

test('builds_an_immutable_default_snapshot_with_ranked_unique_books', () => {
  const source = summary();
  const snapshot = makeAnnualSummarySnapshot(source, DEFAULT_ANNUAL_SUMMARY_PRIVACY, THEMES.forest);
  expect(snapshot.books).toHaveLength(5);
  expect(snapshot.books.slice(0, 3).map(item => item.bookId)).toEqual(['7', '1', '4']);
  expect(new Set(snapshot.books.map(item => item.bookId)).size).toBe(snapshot.books.length);
  expect(snapshot.tags).toEqual(['古代', '强强', '救赎']);
  expect(snapshot.thoughtCount).toBe(12);
  expect(snapshot.currentHighlightCount).toBe(9);
  expect(snapshot.colors.rating).toBe(THEMES.forest.rating);
  source.books[0].title = '后来修改';
  expect(snapshot.books.find(item => item.bookId === '1')?.title).toBe('书1');
});

test('applies_each_privacy_choice_to_the_snapshot_data', () => {
  const source = summary();
  const noTitles = makeAnnualSummarySnapshot(source, { ...DEFAULT_ANNUAL_SUMMARY_PRIVACY, showTitles: false }, THEMES.forest);
  expect(noTitles.books.every(item => item.title === '')).toBe(true);
  expect(JSON.stringify(noTitles)).not.toContain('书1');
  const noCovers = makeAnnualSummarySnapshot(source, { ...DEFAULT_ANNUAL_SUMMARY_PRIVACY, showCovers: false }, THEMES.forest);
  expect(noCovers.books.every(item => item.coverUri === null)).toBe(true);
  const noArchive = makeAnnualSummarySnapshot(source, { ...DEFAULT_ANNUAL_SUMMARY_PRIVACY, showArchiveStats: false }, THEMES.forest);
  expect(noArchive.thoughtCount).toBeNull();
  expect(noArchive.currentHighlightCount).toBeNull();
});

test('handles_sparse_and_tied_candidates_without_duplicates', () => {
  const a = book('a', { title: '同名', coverUri: null });
  const b = book('b', { title: '同名', coverUri: null });
  const snapshot = makeAnnualSummarySnapshot(summary({ books: [a, b], booksReadCount: 2, representativeBooks: [a, b, a], topTags: [] }), DEFAULT_ANNUAL_SUMMARY_PRIVACY, THEMES.forest);
  expect(snapshot.books.map(item => item.bookId)).toEqual(['a', 'b']);
  expect(snapshot.tags).toEqual([]);
});

test('snapshot_visible_fields_exclude_private_or_unrelated_content', () => {
  const snapshot = makeAnnualSummarySnapshot(summary(), DEFAULT_ANNUAL_SUMMARY_PRIVACY, THEMES.forest);
  const visibleCopy = [snapshot.year, snapshot.booksReadCount, ...snapshot.tags, ...snapshot.books.map(item => item.title), snapshot.thoughtCount, snapshot.currentHighlightCount].join('|');
  expect(visibleCopy).not.toContain('作者');
  expect(visibleCopy).not.toContain('首发平台');
  expect(visibleCopy).not.toContain('摘记正文');
  expect(visibleCopy).not.toContain('OCR');
});

