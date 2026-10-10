import { SqliteAnnualSummaryRepository } from '../../src/books/annualSummaryRepository';
import { migrateDatabase } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

process.env.TZ = 'Asia/Shanghai';

type TestDb = ReturnType<typeof createInMemoryDatabase>;

async function seedBook(
  db: TestDb,
  id: string,
  title: string,
  options: { author?: string; type?: string; rating?: number; cover?: string } = {},
) {
  const coverId = options.cover ? `cover:${id}` : null;
  await db.runAsync(
    `INSERT INTO books (id, title, status, created_at, updated_at, author, type, rating_half_stars)
     VALUES (?, ?, 'finished', '2026-01-01', '2026-12-31', ?, ?, ?)`,
    id, title, options.author ?? null, options.type ?? null, options.rating ?? null,
  );
  if (coverId) {
    await db.runAsync(
      'INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES (?, ?, ?, ?)',
      coverId, id, options.cover!, '2026-01-01T00:00:00.000Z',
    );
    await db.runAsync('UPDATE books SET cover_image_id = ? WHERE id = ?', coverId, id);
  }
}

async function finish(db: TestDb, bookId: string, ordinal: number, endedOn: string | null, outcome = 'finished') {
  await db.runAsync(
    `INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome)
     VALUES (?, ?, ?, NULL, ?, ?)`,
    `${bookId}:${ordinal}:${endedOn ?? 'unknown'}`, bookId, ordinal, endedOn, outcome,
  );
}

async function tag(db: TestDb, bookId: string, id: string, name: string, position = 0) {
  await db.runAsync('INSERT OR IGNORE INTO tags (id, name, is_system) VALUES (?, ?, 0)', id, name);
  await db.runAsync('INSERT INTO book_tags (book_id, tag_id, position) VALUES (?, ?, ?)', bookId, id, position);
}

describe('SqliteAnnualSummaryRepository', () => {
  test('counts_each_finished_book_once_and_assigns_earliest_month', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      await seedBook(db, 'a', '甲');
      await seedBook(db, 'b', '乙');
      await finish(db, 'a', 1, '2026-02-03');
      await finish(db, 'a', 2, '2026-10-08');
      await finish(db, 'b', 1, '2026-10-01');

      const summary = await new SqliteAnnualSummaryRepository(db).getYear(2026);

      expect(summary.booksReadCount).toBe(2);
      expect(summary.months).toHaveLength(12);
      expect(summary.months[1]).toMatchObject({ month: 2, bookCount: 1 });
      expect(summary.months[9]).toMatchObject({ month: 10, bookCount: 1 });
      expect(summary.months.reduce((total, month) => total + month.bookCount, 0)).toBe(2);
      expect(summary.books.find(book => book.bookId === 'a')?.rereadCompletionCount).toBe(1);
      expect(summary.firstBook?.bookId).toBe('a');
      expect(summary.lastBook?.bookId).toBe('a');
      expect(summary.peakMonths).toEqual([2, 10]);
    } finally { db.close(); }
  });

  test('excludes_invalid_unknown_and_legacy_dates', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      for (const id of ['valid', 'invalid', 'unknown', 'legacy', 'dropped']) await seedBook(db, id, id);
      await finish(db, 'valid', 1, '2025-12-31');
      await finish(db, 'invalid', 1, '2026-02-30');
      await finish(db, 'unknown', 1, null);
      await db.runAsync('UPDATE books SET legacy_read_count = 1 WHERE id = ?', 'legacy');
      await finish(db, 'dropped', 1, '2026-05-01', 'dropped');

      const repo = new SqliteAnnualSummaryRepository(db);
      expect((await repo.getYear(2026)).books).toEqual([]);
      expect(await repo.availableYears(2026)).toEqual([2026, 2025]);
      await expect(repo.getYear(0)).rejects.toThrow('统计年份无效');
    } finally { db.close(); }
  });

  test('uses_local_and_import_note_dates', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      await seedBook(db, 'read', '当年读完');
      await seedBook(db, 'thought-only', '只写想法');
      await finish(db, 'read', 1, '2026-06-01');
      await db.execAsync(`
        INSERT INTO notes (id, book_id, body, created_at, updated_at, source_kind, original_recorded_on) VALUES
          ('local', 'read', '跨入本地新年', '2026-12-31T16:30:00.000Z', '2026-12-31T16:30:00.000Z', 'app', NULL),
          ('imported', 'thought-only', '旧记录', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 'import', '2026-04-02'),
          ('undated', 'read', '无日期', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 'import', NULL),
          ('invalid', 'read', '无效日期', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 'import', '2026-02-30');
      `);

      const repo = new SqliteAnnualSummaryRepository(db);
      const summary2026 = await repo.getYear(2026);
      expect(summary2026.thoughtCount).toBe(1);
      expect(summary2026.thoughtBookCount).toBe(1);
      expect(summary2026.mostThoughtBooks).toMatchObject([{ bookId: 'thought-only', annualThoughtCount: 1 }]);
      expect(summary2026.books.map(book => book.bookId)).toEqual(['read']);
      expect((await repo.getYear(2027)).thoughtCount).toBe(1);
      expect(await repo.availableYears(2025)).toEqual([2027, 2026, 2025]);
    } finally { db.close(); }
  });

  test('counts_current_highlights_without_claiming_a_year', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      await seedBook(db, 'a', '甲');
      await seedBook(db, 'b', '乙');
      await seedBook(db, 'old', '往年');
      await finish(db, 'a', 1, '2026-03-01');
      await finish(db, 'b', 1, '2026-04-01');
      await finish(db, 'old', 1, '2025-04-01');
      await db.execAsync(`
        INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES
          ('shared', 'a', 'file:///shared', '2024-01-01'),
          ('only-a', 'a', 'file:///only-a', '2024-01-01'),
          ('old-image', 'old', 'file:///old', '2024-01-01');
        INSERT INTO highlight_images (book_id, image_id, position) VALUES
          ('a', 'shared', 0), ('b', 'shared', 0), ('a', 'only-a', 1), ('old', 'old-image', 0);
      `);

      const summary = await new SqliteAnnualSummaryRepository(db).getYear(2026);
      expect(summary.currentHighlightCount).toBe(2);
      expect(summary.books.find(book => book.bookId === 'a')?.currentHighlightCount).toBe(2);
      expect(summary.books.find(book => book.bookId === 'b')?.currentHighlightCount).toBe(1);
    } finally { db.close(); }
  });

  test('ranks_tags_types_authors_ratings_and_representatives_stably', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      await seedBook(db, 'b', '乙', { author: '同作者', type: 'romance_male_male', rating: 10 });
      await seedBook(db, 'a', '甲', { author: '同作者', type: 'romance_male_male', rating: 10 });
      await seedBook(db, 'c', '丙', { author: '另一位', type: 'other', rating: 8 });
      await seedBook(db, 'thought-only', '只写想法');
      await finish(db, 'b', 1, '2026-06-01');
      await finish(db, 'a', 1, '2026-06-01');
      await finish(db, 'c', 1, '2026-08-01');
      await tag(db, 'a', 'system:古代', '古代');
      await tag(db, 'b', 'system:古代', '古代');
      await tag(db, 'a', 't:single', '孤例', 1);
      await db.execAsync(`
        INSERT INTO notes (id, book_id, body, created_at, updated_at, source_kind) VALUES
          ('a-1', 'a', '一', '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z', 'app'),
          ('a-2', 'a', '二', '2026-05-02T00:00:00.000Z', '2026-05-02T00:00:00.000Z', 'app'),
          ('b-1', 'b', '一', '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z', 'app'),
          ('b-2', 'b', '二', '2026-05-02T00:00:00.000Z', '2026-05-02T00:00:00.000Z', 'app'),
          ('x-1', 'thought-only', '不在年度书目', '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', 'app');
        INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES ('note-image', 'a', 'file:///note', '2026-05-01');
        INSERT INTO note_images (note_id, image_id, position) VALUES ('a-1', 'note-image', 0), ('b-1', 'note-image', 0);
      `);

      const summary = await new SqliteAnnualSummaryRepository(db).getYear(2026);
      expect(summary.books.map(book => book.bookId)).toEqual(['b', 'a', 'c']);
      expect(summary.topTags).toEqual([{ key: 'system:古代', label: '古代', count: 2 }]);
      expect(summary.topBookTypes).toEqual([{ key: 'romance_male_male', label: 'BL', count: 2 }]);
      expect(summary.topAuthors).toEqual([{ key: '同作者', label: '同作者', count: 2 }]);
      expect(summary.highestRatingHalfStars).toBe(10);
      expect(summary.topRatedBooks.map(book => book.bookId)).toEqual(['b', 'a']);
      expect(summary.fiveStarBookCount).toBe(2);
      expect(summary.thoughtCount).toBe(5);
      expect(summary.thoughtBookCount).toBe(3);
      expect(summary.thoughtImageCount).toBe(2);
      expect(summary.mostThoughtBooks.map(book => book.bookId)).toEqual(['b', 'a', 'thought-only']);
      expect(summary.representativeBooks.map(book => book.bookId)).toEqual(['b', 'a']);
    } finally { db.close(); }
  });

  test('selects_cover_books_across_the_year_without_duplicates', async () => {
    const db = createInMemoryDatabase();
    try {
      await migrateDatabase(db);
      for (let index = 1; index <= 10; index += 1) {
        const id = `book-${String(index).padStart(2, '0')}`;
        await seedBook(db, id, `书${String(index).padStart(2, '0')}`);
        await finish(db, id, 1, `2026-${String(index).padStart(2, '0')}-01`);
      }

      const summary = await new SqliteAnnualSummaryRepository(db).getYear(2026);
      expect(summary.coverBooks).toHaveLength(6);
      expect(new Set(summary.coverBooks.map(book => book.bookId)).size).toBe(6);
      expect(summary.coverBooks[0].bookId).toBe('book-01');
      expect(summary.coverBooks.at(-1)?.bookId).toBe('book-10');
    } finally { db.close(); }
  });
});
