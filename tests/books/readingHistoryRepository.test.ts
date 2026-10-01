import { randomUUID } from 'node:crypto';
import { SqliteBookRepository } from '../../src/books/sqliteRepository';
import { SqliteReadingHistoryRepository } from '../../src/books/readingHistoryRepository';
import { migrateDatabase } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

test('lists sessions in reading order and backfills an old first read without renumbering a reread', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at, legacy_read_count) VALUES ('old', '旧书', 'finished', 'a', 'b', 1)");
    const books = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const history = new SqliteReadingHistoryRepository(db, randomUUID);
    const old = (await books.get('old'))!;
    await books.update('old', { title: old.title, author: old.author, protagonists: [], status: 'reading' });
    expect((await history.list('old')).map(session => session.ordinal)).toEqual([2]);
    const first = await history.backfillFirst('old', '2026-01-01', '2026-01-20');
    expect(first).toMatchObject({ ordinal: 1, startedOn: '2026-01-01', endedOn: '2026-01-20', outcome: 'finished' });
    expect((await history.list('old')).map(session => session.ordinal)).toEqual([1, 2]);
    expect((await books.get('old'))?.legacyReadCount).toBe(0);
    await expect(history.backfillFirst('old', '2026-01-01', '2026-01-20')).rejects.toThrow();
  } finally { db.close(); }
});

test('backfill rejects non-legacy books and invalid dates without changing the marker', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const books = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const history = new SqliteReadingHistoryRepository(db, randomUUID);
    const fresh = await books.create({ title: '新书', status: 'finished' });
    await expect(history.backfillFirst(fresh.id, '2026-01-01', '2026-01-02')).rejects.toThrow();
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at, legacy_read_count) VALUES ('old', '旧书', 'finished', 'a', 'b', 1)");
    await expect(history.backfillFirst('old', '2026-02-30', '2026-03-01')).rejects.toThrow();
    expect((await books.get('old'))?.legacyReadCount).toBe(1);
  } finally { db.close(); }
});

test('date corrections keep the ID and ordinal and reject invalid or wrong-book updates', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const books = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const history = new SqliteReadingHistoryRepository(db, randomUUID);
    const first = await books.create({ title: '长夜', status: 'finished' });
    const other = await books.create({ title: '别书', status: 'want_to_read' });
    const record = (await history.list(first.id))[0];
    await history.updateDates(first.id, record.id, '2026-09-01', '2026-09-30');
    expect((await history.list(first.id))[0]).toEqual({ ...record, startedOn: '2026-09-01', endedOn: '2026-09-30' });
    await expect(history.updateDates(first.id, record.id, '2026-09-30', '2026-09-01')).rejects.toThrow();
    await expect(history.updateDates(first.id, record.id, '2026-09-01', null)).rejects.toThrow();
    await expect(history.updateDates(other.id, record.id, '2026-09-01', '2026-09-30')).rejects.toThrow();
    expect((await history.list(first.id))[0].startedOn).toBe('2026-09-01');
  } finally { db.close(); }
});

test('deleting a middle record keeps current status and later ordinals intact', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const books = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const history = new SqliteReadingHistoryRepository(db, randomUUID);
    const book = await books.create({ title: '长夜', status: 'finished' });
    const second = await books.update(book.id, { title: book.title, author: null, protagonists: [], status: 'dropped' });
    await books.update(book.id, { title: book.title, author: null, protagonists: [], status: 'finished' });
    const records = await history.list(book.id);
    await history.delete(book.id, records[1].id);
    expect((await history.list(book.id)).map(item => item.ordinal)).toEqual([1, 3]);
    expect((await books.get(book.id))?.status).toBe('finished');
    expect(second.status).toBe('dropped');
  } finally { db.close(); }
});

test('deleting the latest record falls back to the previous result, legacy placeholder, then want', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const books = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const history = new SqliteReadingHistoryRepository(db, randomUUID);
    const book = await books.create({ title: '长夜', status: 'finished' });
    await books.update(book.id, { title: book.title, author: null, protagonists: [], status: 'reading' });
    await history.delete(book.id, (await history.list(book.id))[1].id);
    expect((await books.get(book.id))?.status).toBe('finished');
    await history.delete(book.id, (await history.list(book.id))[0].id);
    expect((await books.get(book.id))?.status).toBe('want_to_read');
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at, legacy_read_count) VALUES ('old', '旧书', 'reading', 'a', 'b', 1)");
    await db.runAsync("INSERT INTO reading_sessions (id, book_id, ordinal, started_on, outcome) VALUES ('second', 'old', 2, '2026-10-02', 'reading')");
    await history.delete('old', 'second');
    expect((await books.get('old'))?.status).toBe('finished');
  } finally { db.close(); }
});

test('a failed backfill or delete transaction rolls back record and book together', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const history = new SqliteReadingHistoryRepository(db, randomUUID);
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at, legacy_read_count) VALUES ('old', '旧书', 'finished', 'a', 'b', 1)");
    await db.execAsync("CREATE TRIGGER fail_backfill BEFORE UPDATE OF legacy_read_count ON books BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
    await expect(history.backfillFirst('old', '2026-01-01', '2026-01-02')).rejects.toThrow('injected failure');
    expect(await history.list('old')).toEqual([]);
    await db.execAsync('DROP TRIGGER fail_backfill');
    const first = await history.backfillFirst('old', '2026-01-01', '2026-01-02');
    await db.execAsync("CREATE TRIGGER fail_status BEFORE UPDATE OF status ON books BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
    await expect(history.delete('old', first.id)).rejects.toThrow('injected failure');
    expect((await history.list('old')).map(item => item.id)).toEqual([first.id]);
  } finally { db.close(); }
});
