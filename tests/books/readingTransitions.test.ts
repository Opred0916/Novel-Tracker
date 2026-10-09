import { randomUUID } from 'node:crypto';
import { SqliteBookRepository } from '../../src/books/sqliteRepository';
import type { Book, BookStatus } from '../../src/books/types';
import { migrateDatabase } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

type SessionRow = { ordinal: number; started_on: string; ended_on: string | null; outcome: string };

function edit(book: Book, status: BookStatus, readingDates?: { startedOn: string; endedOn?: string | null }) {
  return { title: book.title, author: book.author, protagonists: book.protagonists, status, ...(readingDates ? { readingDates } : {}) };
}

test.each([
  ['want_to_read', []],
  ['reading', [{ ordinal: 1, started_on: '2026-10-02', ended_on: null, outcome: 'reading' }]],
  ['finished', [{ ordinal: 1, started_on: '2026-10-02', ended_on: '2026-10-02', outcome: 'finished' }]],
  ['dropped', [{ ordinal: 1, started_on: '2026-10-02', ended_on: '2026-10-02', outcome: 'dropped' }]],
] as const)('creates a %s book with the matching first reading record', async (status, expected) => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const book = await repo.create({ title: '长夜', status });
    expect(await db.getAllAsync<SessionRow>('SELECT ordinal, started_on, ended_on, outcome FROM reading_sessions WHERE book_id = ?', book.id))
      .toEqual(expected);
    expect((await repo.get(book.id))?.legacyReadCount).toBe(0);
  } finally { db.close(); }
});

test('uses edited dates for a newly finished book and preserves its overall rating', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const book = await repo.create({
      title: '长夜', status: 'finished', ratingHalfStars: 9,
      readingDates: { startedOn: '2026-09-01', endedOn: '2026-09-15' },
    });
    expect(book.ratingHalfStars).toBe(9);
    expect(await db.getAllAsync<SessionRow>('SELECT ordinal, started_on, ended_on, outcome FROM reading_sessions')).toEqual([
      { ordinal: 1, started_on: '2026-09-01', ended_on: '2026-09-15', outcome: 'finished' },
    ]);
  } finally { db.close(); }
});

test('revisiting a finished book creates a second reading and dropping it keeps the first and rating', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const first = await repo.create({ title: '长夜', status: 'finished', ratingHalfStars: 9 });
    const rereading = await repo.update(first.id, edit(first, 'reading', { startedOn: '2026-10-01' }));
    expect(rereading.ratingHalfStars).toBe(9);
    const dropped = await repo.update(first.id, edit(rereading, 'dropped', { startedOn: '2026-10-01', endedOn: '2026-10-03' }));
    expect(dropped.ratingHalfStars).toBe(9);
    expect(await db.getAllAsync<SessionRow>('SELECT ordinal, started_on, ended_on, outcome FROM reading_sessions ORDER BY ordinal')).toEqual([
      { ordinal: 1, started_on: '2026-10-02', ended_on: '2026-10-02', outcome: 'finished' },
      { ordinal: 2, started_on: '2026-10-01', ended_on: '2026-10-03', outcome: 'dropped' },
    ]);
  } finally { db.close(); }
});

test('finishes an active attempt but does not create another record when the status stays unchanged', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const book = await repo.create({ title: '长夜', status: 'reading' });
    const finished = await repo.update(book.id, edit(book, 'finished'));
    await repo.update(book.id, edit(finished, 'finished'));
    expect(await db.getAllAsync<SessionRow>('SELECT ordinal, started_on, ended_on, outcome FROM reading_sessions')).toEqual([
      { ordinal: 1, started_on: '2026-10-02', ended_on: '2026-10-02', outcome: 'finished' },
    ]);
  } finally { db.close(); }
});

test('an old finished book starts at reread number two without inventing a first dated record', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at, legacy_read_count) VALUES ('old', '旧书', 'finished', 'a', 'b', 1)");
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const old = await repo.get('old');
    expect(old).not.toBeNull();
    const rereading = await repo.update('old', edit(old!, 'reading'));
    expect(rereading.legacyReadCount).toBe(1);
    expect(await db.getAllAsync<SessionRow>('SELECT ordinal, started_on, ended_on, outcome FROM reading_sessions')).toEqual([
      { ordinal: 2, started_on: '2026-10-02', ended_on: null, outcome: 'reading' },
    ]);
  } finally { db.close(); }
});

test('an old reading book without a session gets a complete first record when marked finished', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at) VALUES ('old', '旧书', 'reading', 'a', 'b')");
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    await repo.update('old', edit((await repo.get('old'))!, 'finished'));
    expect(await db.getAllAsync<SessionRow>('SELECT ordinal, started_on, ended_on, outcome FROM reading_sessions')).toEqual([
      { ordinal: 1, started_on: '2026-10-02', ended_on: '2026-10-02', outcome: 'finished' },
    ]);
  } finally { db.close(); }
});

test('changing reading back to want cancels only the active attempt', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const finished = await repo.create({ title: '长夜', status: 'finished' });
    const rereading = await repo.update(finished.id, edit(finished, 'reading'));
    const wanted = await repo.update(finished.id, edit(rereading, 'want_to_read'));
    expect(wanted.status).toBe('want_to_read');
    expect(await db.getAllAsync<SessionRow>('SELECT ordinal, started_on, ended_on, outcome FROM reading_sessions')).toEqual([
      { ordinal: 1, started_on: '2026-10-02', ended_on: '2026-10-02', outcome: 'finished' },
    ]);
  } finally { db.close(); }
});

test('rolls back book creation and status update when writing the reading record fails', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const wanted = await repo.create({ title: '长夜', status: 'want_to_read' });
    await db.execAsync("CREATE TRIGGER fail_reading BEFORE INSERT ON reading_sessions BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
    await expect(repo.create({ title: '新书', status: 'finished' })).rejects.toThrow('injected failure');
    await expect(repo.update(wanted.id, edit(wanted, 'reading'))).rejects.toThrow('injected failure');
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM books')).toEqual({ count: 1 });
    expect((await repo.get(wanted.id))?.status).toBe('want_to_read');
    expect(await db.getAllAsync('SELECT * FROM reading_sessions')).toEqual([]);
  } finally { db.close(); }
});

test('invalid reading dates and repeated status saves cannot create extra records', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const wanted = await repo.create({ title: '长夜', status: 'want_to_read' });
    await expect(repo.update(wanted.id, edit(wanted, 'finished', { startedOn: '2026-02-30', endedOn: '2026-03-01' }))).rejects.toThrow();
    expect((await repo.get(wanted.id))?.status).toBe('want_to_read');
    const finished = await repo.update(wanted.id, edit(wanted, 'finished'));
    await repo.update(wanted.id, edit(finished, 'finished'));
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM reading_sessions')).toEqual({ count: 1 });
  } finally { db.close(); }
});

test('quick finish updates the active session and overall rating in one operation', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const book = await repo.create({ title: '长夜', status: 'reading', readingDates: { startedOn: '2026-09-01' } });
    const finished = await repo.endReading(book.id, { outcome: 'finished', startedOn: '2026-09-01', endedOn: '2026-10-01', ratingHalfStars: 9 });
    expect(finished).toMatchObject({ status: 'finished', ratingHalfStars: 9 });
    expect(await db.getAllAsync<SessionRow>('SELECT ordinal, started_on, ended_on, outcome FROM reading_sessions')).toEqual([
      { ordinal: 1, started_on: '2026-09-01', ended_on: '2026-10-01', outcome: 'finished' },
    ]);
  } finally { db.close(); }
});

test('quick drop keeps an existing rating and stale quick finish creates no session', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    const finished = await repo.create({ title: '长夜', status: 'finished', ratingHalfStars: 8 });
    const reading = await repo.update(finished.id, edit(finished, 'reading'));
    const dropped = await repo.endReading(reading.id, { outcome: 'dropped', startedOn: '2026-10-02', endedOn: '2026-10-03' });
    expect(dropped).toMatchObject({ status: 'dropped', ratingHalfStars: 8 });
    await expect(repo.endReading(reading.id, { outcome: 'finished', startedOn: '2026-10-02', endedOn: '2026-10-03', ratingHalfStars: 10 })).rejects.toThrow('阅读状态已经变化');
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM reading_sessions')).toEqual({ count: 2 });
  } finally { db.close(); }
});

test('quick finish validates dates and fills a legacy reading row without an active session', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at) VALUES ('old', '旧书', 'reading', 'a', 'b')");
    const repo = new SqliteBookRepository(db, randomUUID, () => '2026-10-02');
    await expect(repo.endReading('old', { outcome: 'finished', startedOn: '2026-10-04', endedOn: '2026-10-03', ratingHalfStars: null })).rejects.toThrow('结束日期不能早于开始日期');
    await expect(repo.endReading('old', { outcome: 'finished', startedOn: '2026-10-02', endedOn: '2026-10-03', ratingHalfStars: 11 })).rejects.toThrow('评分必须');
    expect(await db.getAllAsync('SELECT * FROM reading_sessions')).toEqual([]);
    const saved = await repo.endReading('old', { outcome: 'finished', startedOn: '2026-10-02', endedOn: '2026-10-03', ratingHalfStars: null });
    expect(saved.status).toBe('finished');
    expect(await db.getAllAsync<SessionRow>('SELECT ordinal, started_on, ended_on, outcome FROM reading_sessions')).toEqual([
      { ordinal: 1, started_on: '2026-10-02', ended_on: '2026-10-03', outcome: 'finished' },
    ]);
  } finally { db.close(); }
});
