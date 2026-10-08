import {
  annualBooksSentence,
  buildAnnualStoryPages,
  formatAnnualSummaryDate,
  peakMonthSentence,
} from '../../src/books/annualStoryPages';
import type { AnnualStorySummary, AnnualSummaryBook } from '../../src/books/annualSummaryRepository';

function book(id: string, overrides: Partial<AnnualSummaryBook> = {}): AnnualSummaryBook {
  return {
    bookId: id,
    title: `书${id}`,
    author: null,
    coverUri: null,
    bookType: null,
    tags: [],
    ratingHalfStars: null,
    firstFinishedOn: '2026-01-03',
    lastFinishedOn: '2026-01-03',
    rereadCompletionCount: 0,
    annualThoughtCount: 0,
    annualThoughtImageCount: 0,
    currentHighlightCount: 0,
    ...overrides,
  };
}

function summary(overrides: Partial<AnnualStorySummary> = {}): AnnualStorySummary {
  const first = book('a');
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, bookCount: index === 0 ? 1 : 0, books: index === 0 ? [first] : [] }));
  return {
    year: 2026,
    booksReadCount: 1,
    books: [first],
    coverBooks: [first],
    firstBook: first,
    lastBook: first,
    months,
    peakMonths: [1],
    topTags: [],
    topBookTypes: [],
    topAuthors: [],
    highestRatingHalfStars: null,
    topRatedBooks: [],
    fiveStarBookCount: 0,
    thoughtCount: 0,
    thoughtBookCount: 0,
    thoughtImageCount: 0,
    currentHighlightCount: 0,
    mostThoughtBooks: [],
    rereadBooks: [],
    representativeBooks: [],
    ...overrides,
  };
}

describe('buildAnnualStoryPages', () => {
  test('builds_full_story_in_fixed_order', () => {
    const rated = book('rated', { ratingHalfStars: 10, rereadCompletionCount: 1, annualThoughtCount: 2 });
    const pages = buildAnnualStoryPages(summary({
      topTags: [{ key: 'tag', label: '古代', count: 2 }],
      highestRatingHalfStars: 10,
      topRatedBooks: [rated],
      thoughtCount: 2,
      rereadBooks: [rated],
      representativeBooks: [rated],
    }));
    expect(pages.map(page => page.id)).toEqual([
      'cover', 'books', 'months', 'preference', 'rating', 'archive', 'reread', 'representative', 'share',
    ]);
  });

  test('omits_pages_without_qualifying_data', () => {
    const pages = buildAnnualStoryPages(summary({
      topAuthors: [{ key: 'author', label: '作者', count: 2 }],
      thoughtCount: 0,
      thoughtImageCount: 0,
      currentHighlightCount: 0,
    }));
    expect(pages.map(page => page.id)).toEqual(['cover', 'books', 'months', 'share']);
  });

  test('keeps_core_story_for_one_book', () => {
    expect(buildAnnualStoryPages(summary()).map(page => page.id)).toEqual(['cover', 'books', 'months', 'share']);
  });

  test('returns_no_story_for_zero_finished_books', () => {
    expect(buildAnnualStoryPages(summary({ booksReadCount: 0, books: [], coverBooks: [], firstBook: null, lastBook: null }))).toEqual([]);
  });
});

describe('annual story copy helpers', () => {
  test('formats_valid_zero_padded_dates', () => {
    expect(formatAnnualSummaryDate('2026-01-03')).toBe('1 月 3 日');
    expect(formatAnnualSummaryDate('2026-02-30')).toBe('');
  });

  test('describes_one_peak_month', () => {
    expect(peakMonthSentence(summary({ peakMonths: [7], months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, bookCount: index === 6 ? 12 : 0, books: [] })) })))
      .toBe('7 月是你最沉浸的月份，你在这个月读完了 12 本小说。');
  });

  test('describes_two_or_three_tied_peak_months', () => {
    expect(peakMonthSentence(summary({ peakMonths: [3, 7] }))).toBe('3 月和 7 月是你最沉浸的月份。');
    expect(peakMonthSentence(summary({ peakMonths: [1, 4, 9] }))).toBe('1 月、4 月和 9 月是你最沉浸的月份。');
  });

  test('uses_even_distribution_copy_for_more_than_three_ties', () => {
    expect(peakMonthSentence(summary({ peakMonths: [1, 3, 7, 9] }))).toBe('你的阅读均匀分布在这一年。');
  });

  test('does_not_repeat_the_same_book_as_first_and_last', () => {
    expect(annualBooksSentence(summary())).toBe('这一年，从《书a》开始，也暂时停在这里。');
    const last = book('z', { title: '最后一本', firstFinishedOn: '2026-12-26', lastFinishedOn: '2026-12-26' });
    expect(annualBooksSentence(summary({ booksReadCount: 2, lastBook: last })))
      .toBe('从 1 月 3 日的《书a》开始，到 12 月 26 日的《最后一本》结束。');
  });
});
