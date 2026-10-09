import { shouldShowBackupReminder, shouldShowIntro } from '../../src/dataSafety/visibility';

const emptyShelf = {
  introSeen: false, totalBooks: 0, status: null, hasConditions: false,
  loading: false, resultsCurrent: true, bulkMode: false,
};

test('only a true unhandled empty bookshelf shows the introduction', () => {
  expect(shouldShowIntro(emptyShelf)).toBe(true);
  expect(shouldShowIntro({ ...emptyShelf, introSeen: true })).toBe(false);
  expect(shouldShowIntro({ ...emptyShelf, introSeen: null })).toBe(false);
  expect(shouldShowIntro({ ...emptyShelf, totalBooks: 1 })).toBe(false);
  expect(shouldShowIntro({ ...emptyShelf, totalBooks: null })).toBe(false);
});

test('status, search, loading and bulk mode cannot turn empty results into first use', () => {
  expect(shouldShowIntro({ ...emptyShelf, status: 'want_to_read' })).toBe(false);
  expect(shouldShowIntro({ ...emptyShelf, hasConditions: true })).toBe(false);
  expect(shouldShowIntro({ ...emptyShelf, loading: true })).toBe(false);
  expect(shouldShowIntro({ ...emptyShelf, resultsCurrent: false })).toBe(false);
  expect(shouldShowIntro({ ...emptyShelf, bulkMode: true })).toBe(false);
});

test('management reminder appears once for a populated library without generated backup', () => {
  expect(shouldShowBackupReminder({ handled: false, bookCount: 1, lastGeneratedAt: null })).toBe(true);
  expect(shouldShowBackupReminder({ handled: true, bookCount: 1, lastGeneratedAt: null })).toBe(false);
  expect(shouldShowBackupReminder({ handled: null, bookCount: 1, lastGeneratedAt: null })).toBe(false);
  expect(shouldShowBackupReminder({ handled: false, bookCount: 0, lastGeneratedAt: null })).toBe(false);
  expect(shouldShowBackupReminder({ handled: false, bookCount: null, lastGeneratedAt: null })).toBe(false);
  expect(shouldShowBackupReminder({ handled: false, bookCount: 1, lastGeneratedAt: '2026-10-09T08:00:00Z' })).toBe(false);
});
