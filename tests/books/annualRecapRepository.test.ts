import { migrateDatabase } from '../../src/storage/database';
import { SqliteAnnualRecapRepository } from '../../src/books/annualRecapRepository';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

process.env.TZ = 'Asia/Shanghai';

async function seedBook(db: ReturnType<typeof createInMemoryDatabase>, id: string, title: string, status = 'finished') {
  await db.runAsync(
    'INSERT INTO books (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id, title, status, '2026-01-01', '2026-12-31',
  );
}

describe('SqliteAnnualRecapRepository', () => {
  test('counts distinct books and completed sessions by the effective ending year', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      await seedBook(db, 'one', '一');
      await seedBook(db, 'two', '二');
      await seedBook(db, 'dropped', '弃读', 'dropped');
      await db.execAsync(`
        INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES
          ('one-1', 'one', 1, '2025-12-20', '2026-01-02', 'finished'),
          ('one-2', 'one', 2, '2026-06-01', '2026-06-30', 'finished'),
          ('two-1', 'two', 1, '2026-01-01', '2026-07-01', 'finished'),
          ('two-2', 'two', 2, '2026-08-01', '2027-01-01', 'finished'),
          ('dropped-1', 'dropped', 1, '2026-01-01', '2026-02-01', 'dropped'),
          ('reading-1', 'two', 3, '2026-03-01', NULL, 'reading');
      `);
      const repo = new SqliteAnnualRecapRepository(db);
      const recap = await repo.getYear(2026);
      expect(recap.finishedBookCount).toBe(2);
      expect(recap.completedReadingCount).toBe(3);
      expect(recap.books.map(book => [book.title, book.sessions.map(session => session.ordinal)])).toEqual([
        ['二', [1]], ['一', [2, 1]],
      ]);
      expect((await repo.getYear(2027)).finishedBookCount).toBe(1);
      expect((await repo.getYear(2027)).completedReadingCount).toBe(1);
    } finally { db.close(); }
  });

  test('excludes unknown, invalid, legacy-only and non-finished dates', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      await seedBook(db, 'unknown', '未知');
      await seedBook(db, 'legacy', '旧版');
      await db.runAsync('UPDATE books SET legacy_read_count = 1 WHERE id = ?', 'legacy');
      await seedBook(db, 'invalid', '无效');
      await db.execAsync(`
        INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES
          ('unknown-1', 'unknown', 1, NULL, NULL, 'finished'),
          ('legacy-1', 'legacy', 2, NULL, NULL, 'finished'),
          ('invalid-1', 'invalid', 1, '2026-02-01', '2026-02-30', 'finished');
      `);
      const repo = new SqliteAnnualRecapRepository(db);
      expect((await repo.getYear(2026)).books).toEqual([]);
      expect(await repo.availableYears(2026)).toEqual([2026]);
    } finally { db.close(); }
  });

  test('assigns app thoughts using the device local calendar date', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      await seedBook(db, 'one', '跨年书');
      await db.runAsync(
        'INSERT INTO notes (id, book_id, body, created_at, updated_at, source_kind) VALUES (?, ?, ?, ?, ?, ?)',
        'note-local', 'one', '本地已经是 2027 年', '2026-12-31T16:30:00.000Z', '2026-12-31T16:30:00.000Z', 'app',
      );
      const repo = new SqliteAnnualRecapRepository(db);
      expect((await repo.getYear(2026)).thoughts).toEqual([]);
      expect((await repo.getYear(2027)).thoughts).toMatchObject([{ id: 'note-local', recordedOn: '2027-01-01' }]);
    } finally { db.close(); }
  });

  test('uses imported original dates and keeps unknown dates separate from import time', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      await seedBook(db, 'one', '旧记录');
      await db.execAsync(`
        INSERT INTO notes (id, book_id, body, created_at, updated_at, source_kind, original_recorded_on, original_recorded_time) VALUES
          ('dated', 'one', '原日期', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 'import', '2024-10-27', '12:12'),
          ('unknown', 'one', '无日期', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 'import', NULL, NULL),
          ('invalid', 'one', '无效日期', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 'import', '2026-02-30', NULL);
      `);
      const repo = new SqliteAnnualRecapRepository(db);
      expect((await repo.getYear(2024)).thoughts).toMatchObject([{ id: 'dated', recordedOn: '2024-10-27', recordedTime: '12:12' }]);
      expect((await repo.getYear(2026)).thoughts).toEqual([]);
      expect((await repo.listUndatedThoughts()).map(note => note.id)).toEqual(['invalid', 'unknown']);
    } finally { db.close(); }
  });

  test('orders years, books, sessions and thoughts deterministically and counts images', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      await seedBook(db, 'a', '甲');
      await seedBook(db, 'b', '乙');
      await db.execAsync(`
        INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES
          ('a-1', 'a', 1, '2026-01-01', '2026-06-01', 'finished'),
          ('b-1', 'b', 1, '2026-01-01', '2026-06-01', 'finished'),
          ('b-2', 'b', 2, '2026-01-02', '2026-06-01', 'finished');
        INSERT INTO notes (id, book_id, body, created_at, updated_at, source_kind) VALUES
          ('thought-a', 'a', '同日较早 ID', '2026-06-01T01:00:00.000Z', '2026-06-01T01:00:00.000Z', 'app'),
          ('thought-b', 'b', '同日较晚 ID', '2026-06-01T02:00:00.000Z', '2026-06-01T02:00:00.000Z', 'app');
        INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES ('image-1', 'a', 'file:///image-1', '2026-06-01T00:00:00.000Z');
        INSERT INTO note_images (note_id, image_id, position) VALUES ('thought-a', 'image-1', 0);
      `);
      const repo = new SqliteAnnualRecapRepository(db);
      const recap = await repo.getYear(2026);
      expect(recap.books.map(book => book.title)).toEqual(['乙', '甲']);
      expect(recap.books[0].sessions.map(session => session.ordinal)).toEqual([2, 1]);
      expect(recap.thoughts.map(note => note.id)).toEqual(['thought-b', 'thought-a']);
      expect(recap.thoughts.find(note => note.id === 'thought-a')?.imageCount).toBe(1);
      expect(await repo.availableYears(2025)).toEqual([2026, 2025]);
    } finally { db.close(); }
  });

  test('rejects incomplete or normalized app timestamps and preserves sub-minute order', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      await seedBook(db, 'one', '严格时间');
      await db.execAsync(`
        INSERT INTO notes (id, book_id, body, created_at, updated_at, source_kind) VALUES
          ('z-earlier', 'one', '更早', '2026-06-01T00:00:01.000Z', '2026-06-01T00:00:01.000Z', 'app'),
          ('a-later', 'one', '更晚', '2026-06-01T00:00:59.000Z', '2026-06-01T00:00:59.000Z', 'app'),
          ('invalid-day', 'one', '无效日期', '2026-02-30T00:00:00.000Z', '2026-02-30T00:00:00.000Z', 'app'),
          ('incomplete', 'one', '不完整日期', '2026', '2026', 'app');
      `);
      const thoughts = (await new SqliteAnnualRecapRepository(db).getYear(2026)).thoughts;
      expect(thoughts.map(note => note.id)).toEqual(['a-later', 'z-earlier']);
      expect(thoughts.map(note => note.body)).not.toEqual(expect.arrayContaining(['无效日期', '不完整日期']));
    } finally { db.close(); }
  });
});
