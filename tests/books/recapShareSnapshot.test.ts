import { makeRecapShareSnapshot } from '../../src/books/recapShareSnapshot';
import type { ThemedRecap } from '../../src/books/themedRecapRepository';
import { THEMES } from '../../src/theme/theme';

const book = (bookId: string, endedOn = '2026-09-12') => ({
  bookId, title: '同名书', coverUri: null, ratingHalfStars: 10,
  sessions: [{ id: `${bookId}-s`, ordinal: 2, outcome: 'finished' as const, startedOn: null, endedOn },
    { id: `${bookId}-old`, ordinal: 1, outcome: 'finished' as const, startedOn: null, endedOn: '2026-01-01' }],
});

test('keeps distinct books, latest theme date, palette, and excludes private content', () => {
  const recap: ThemedRecap = { year: 2026, rereadSuccess: [], fiveStar: [book('same-title-a'), book('same-title-b')], dropped: [] };
  const snapshot = makeRecapShareSnapshot(recap, 'fiveStar', THEMES.forest);
  expect(snapshot?.books.map(item => item.bookId)).toEqual(['same-title-a', 'same-title-b']);
  expect(snapshot?.books[0].endedOn).toBe('2026-09-12');
  expect(snapshot?.description).toContain('当前总体评分 5 星');
  expect(snapshot?.colors.primary).toBe(THEMES.forest.primary);
  expect(JSON.stringify(snapshot)).not.toContain('私人摘记正文');
  recap.fiveStar[0].title = '后来修改';
  expect(snapshot?.books[0].title).toBe('同名书');
});

test('empty theme is unavailable and seven books keep true total', () => {
  const recap: ThemedRecap = { year: 2026, rereadSuccess: [], fiveStar: Array.from({ length: 7 }, (_, i) => book(`book-${i}`)), dropped: [] };
  expect(makeRecapShareSnapshot(recap, 'dropped', THEMES.forest)).toBeNull();
  const snapshot = makeRecapShareSnapshot(recap, 'fiveStar', THEMES.forest);
  expect(snapshot?.totalBooks).toBe(7);
  expect(snapshot?.overflowCount).toBe(1);
  expect(snapshot?.books).toHaveLength(6);
});
