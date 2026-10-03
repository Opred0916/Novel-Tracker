import { migrateDatabase } from '../../src/storage/database';
import { SqliteLibraryOverviewRepository } from '../../src/books/libraryOverviewRepository';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

test('counts statuses and distinct books finished in the requested year', async () => {
  const db = createInMemoryDatabase();
  await migrateDatabase(db);
  await db.execAsync(`
    INSERT INTO books (id, title, status, created_at, updated_at) VALUES
      ('one', '一', 'reading', '2026-01-01', '2026-10-01'),
      ('two', '二', 'finished', '2026-01-01', '2026-10-01'),
      ('three', '三', 'want_to_read', '2026-01-01', '2026-10-01'),
      ('four', '四', 'dropped', '2026-01-01', '2026-10-01'),
      ('five', '五', 'finished', '2026-01-01', '2026-10-01'),
      ('legacy', '旧', 'finished', '2026-01-01', '2026-10-01');
    INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES
      ('one-1', 'one', 1, '2026-01-01', '2026-02-03', 'finished'),
      ('one-2', 'one', 2, '2026-04-01', '2026-05-01', 'finished'),
      ('two-1', 'two', 1, '2025-01-01', '2025-02-01', 'finished'),
      ('five-1', 'five', 1, '2026-01-01', NULL, 'reading'),
      ('five-2', 'five', 2, '2026-03-01', '2026-04-01', 'finished'),
      ('four-1', 'four', 1, '2026-01-01', '2026-03-01', 'dropped');
  `);
  const overview = await new SqliteLibraryOverviewRepository(db).getOverview(2026);
  expect(overview).toEqual({ totalBooks: 6, byStatus: { want_to_read: 1, reading: 1, finished: 3, dropped: 1 }, finishedBooksThisYear: 2, year: 2026 });
  db.close();
});

test('unknown and legacy-only dates are not counted, and another year can be queried', async () => {
  const db = createInMemoryDatabase();
  await migrateDatabase(db);
  await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at, legacy_read_count) VALUES ('one', '一', 'finished', '2026-01-01', '2026-10-01', 1)");
  await db.runAsync("INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES ('one-1', 'one', 1, NULL, NULL, 'finished')");
  const repo = new SqliteLibraryOverviewRepository(db);
  expect((await repo.getOverview(2026)).finishedBooksThisYear).toBe(0);
  expect((await repo.getOverview(2025)).finishedBooksThisYear).toBe(0);
  db.close();
});
