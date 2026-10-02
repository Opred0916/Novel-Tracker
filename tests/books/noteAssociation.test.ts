import { findReadingSessionForNote } from '../../src/books/noteAssociation';
import type { ReadingSession } from '../../src/books/types';

const session = (overrides: Partial<ReadingSession>): ReadingSession => ({
  id: 'session-1', bookId: 'book-1', ordinal: 1, startedOn: '2026-01-01', endedOn: '2026-01-10', outcome: 'finished', ...overrides,
});

test('matches a note inside a finished reading range', () => {
  expect(findReadingSessionForNote('2026-01-05', [session({})])).toBe('session-1');
});

test('matches an in-progress reading from its start date onward', () => {
  expect(findReadingSessionForNote('2026-02-20', [session({ id: 'reading', startedOn: '2026-02-01', endedOn: null, outcome: 'reading' })])).toBe('reading');
});

test('chooses the highest ordinal when ranges overlap', () => {
  expect(findReadingSessionForNote('2026-03-05', [
    session({ id: 'first', ordinal: 1, startedOn: '2026-03-01', endedOn: '2026-03-10' }),
    session({ id: 'second', ordinal: 2, startedOn: '2026-03-05', endedOn: '2026-03-10' }),
  ])).toBe('second');
});

test('returns null for dates before a session or without sessions', () => {
  expect(findReadingSessionForNote('2025-12-31', [session({})])).toBeNull();
  expect(findReadingSessionForNote('2026-01-05', [])).toBeNull();
});
