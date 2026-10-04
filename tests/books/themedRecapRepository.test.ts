import { migrateDatabase } from '../../src/storage/database';
import { SqliteThemedRecapRepository } from '../../src/books/themedRecapRepository';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

async function seed(db: ReturnType<typeof createInMemoryDatabase>) {
  await migrateDatabase(db);
  await db.runAsync("INSERT INTO books (id, title, status, rating_half_stars, created_at, updated_at) VALUES ('reread', '重读之书', 'finished', 10, '2025-01-01', '2026-02-01')");
  await db.runAsync("INSERT INTO books (id, title, status, rating_half_stars, created_at, updated_at) VALUES ('dropped', '弃读之书', 'dropped', NULL, '2026-01-01', '2026-03-01')");
  await db.runAsync("INSERT INTO books (id, title, status, rating_half_stars, created_at, updated_at) VALUES ('old-five', '去年五星', 'finished', 10, '2025-01-01', '2025-12-01')");
  await db.runAsync("INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES ('r1', 'reread', 1, '2025-01-01', '2025-01-10', 'finished'), ('r2', 'reread', 2, '2026-01-01', '2026-01-10', 'finished'), ('d1', 'dropped', 1, '2026-02-01', '2026-02-03', 'dropped'), ('o1', 'old-five', 1, '2025-11-01', '2025-11-10', 'finished')");
  await db.runAsync("INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES ('d-old', 'dropped', 2, '2024-02-01', '2024-02-03', 'dropped')");
}

test('builds themed cards from real dated reading sessions', async () => {
  const db = createInMemoryDatabase();
  try {
    await seed(db);
    const repository = new SqliteThemedRecapRepository(db);
    const recap = await repository.getYear(2026);
    expect(recap.rereadSuccess.map(book => book.title)).toEqual(['重读之书']);
    expect(recap.fiveStar.map(book => book.title)).toEqual(['重读之书']);
    expect(recap.dropped.map(book => book.title)).toEqual(['弃读之书']);
    expect(recap.fiveStar.map(book => book.title)).not.toContain('去年五星');
  } finally { db.close(); }
});

test('includes years that only contain dropped sessions', async () => {
  const db = createInMemoryDatabase();
  try {
    await seed(db);
    const repository = new SqliteThemedRecapRepository(db);
    await expect(repository.availableYears(2026)).resolves.toEqual([2026, 2025, 2024]);
  } finally { db.close(); }
});
