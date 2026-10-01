import { normalizeReadingDates, todayLocalDate } from '../../src/books/readingDates';

test('uses the local calendar date, including near local midnight', () => {
  expect(todayLocalDate(new Date(2026, 9, 2, 0, 1))).toBe('2026-10-02');
});

test('accepts valid leap day and same-day completion', () => {
  expect(normalizeReadingDates('finished', '2024-02-29', '2024-02-29')).toEqual({
    startedOn: '2024-02-29', endedOn: '2024-02-29',
  });
  expect(normalizeReadingDates('reading', '2026-10-02')).toEqual({ startedOn: '2026-10-02', endedOn: null });
});

test.each([
  ['2026-02-30', '2026-03-01'],
  ['', '2026-03-01'],
  ['2026-03-02', '2026-03-01'],
  ['2026-3-1', '2026-03-01'],
])('rejects invalid or reversed dates: %s to %s', (start, end) => {
  expect(() => normalizeReadingDates('finished', start, end)).toThrow();
});

test('requires an end date for finished and dropped records', () => {
  expect(() => normalizeReadingDates('finished', '2026-10-02', null)).toThrow();
  expect(() => normalizeReadingDates('dropped', '2026-10-02', null)).toThrow();
  expect(() => normalizeReadingDates('reading', '2026-10-02', '2026-10-02')).toThrow();
});
