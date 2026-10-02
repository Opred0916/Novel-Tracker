import { SqliteBookSearchRepository } from '../../src/books/bookSearchRepository';
import { SqliteBookRepository } from '../../src/books/sqliteRepository';
import { migrateDatabase } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';
import type { BookSearchFilters } from '../../src/books/bookSearch';

const all: BookSearchFilters = { query: '', status: null, bookType: null, tagIds: [] };

async function setup() {
  const db = createInMemoryDatabase();
  await migrateDatabase(db);
  await db.execAsync(`
    INSERT INTO books (id, title, author, status, type, created_at, updated_at) VALUES
      ('one', '长夜', 'Priest', 'finished', 'romance_male_male', '2026-01-01', '2026-10-02'),
      ('two', '归途', '另一作者', 'reading', 'other', '2026-01-01', '2026-10-01'),
      ('special', '50%_完成\\记录', NULL, 'want_to_read', NULL, '2026-01-01', '2026-09-01'),
      ('same-a', '同名书', '甲', 'want_to_read', NULL, '2026-01-01', '2026-08-02'),
      ('same-b', '同名书', '乙', 'want_to_read', NULL, '2026-01-01', '2026-08-01');
    INSERT INTO book_protagonists VALUES ('one', 0, '顾昀');
    INSERT INTO book_protagonists VALUES ('two', 0, '小林');
    INSERT INTO book_tags VALUES ('one', 'system:古代', 0);
    INSERT INTO book_tags VALUES ('one', 'system:悬疑', 1);
    INSERT INTO book_tags VALUES ('two', 'system:古代', 0);
    INSERT INTO notes (id, book_id, body, created_at, updated_at) VALUES
      ('note-1', 'one', '读完以后觉得非常值得重读，人物关系很动人。', '2026-10-01T10:00:00Z', '2026-10-01T10:00:00Z'),
      ('note-2', 'one', '二刷仍然值得重读。', '2026-10-02T10:00:00Z', '2026-10-02T10:00:00Z'),
      ('note-3', 'two', '整体轻松。', '2026-10-01T10:00:00Z', '2026-10-01T10:00:00Z');
  `);
  return { db, repo: new SqliteBookSearchRepository(db, new SqliteBookRepository(db)) };
}

test.each([
  ['长夜', 'one'], ['priest', 'one'], ['顾昀', 'one'], ['轻松', 'two'],
])('searches allowed field %s', async (query, id) => {
  const { db, repo } = await setup();
  try { expect((await repo.search({ ...all, query })).map(result => result.book.id)).toEqual([id]); }
  finally { db.close(); }
});

test('does not keyword-search work types or tags', async () => {
  const { db, repo } = await setup();
  try {
    expect(await repo.search({ ...all, query: '耽美' })).toEqual([]);
    expect(await repo.search({ ...all, query: '悬疑' })).toEqual([]);
  } finally { db.close(); }
});

test('combines terms across author and note and returns a note snippet once', async () => {
  const { db, repo } = await setup();
  try {
    const results = await repo.search({ ...all, query: 'Priest 重读' });
    expect(results).toHaveLength(1);
    expect(results[0].book.id).toBe('one');
    expect(results[0].matchedNoteSnippet).toContain('重读');
  } finally { db.close(); }
});

test('combines status, type and every selected tag', async () => {
  const { db, repo } = await setup();
  try {
    expect((await repo.search({ query: '', status: 'finished', bookType: 'romance_male_male', tagIds: ['system:古代', 'system:悬疑'] })).map(result => result.book.id)).toEqual(['one']);
    expect(await repo.search({ query: '', status: 'reading', bookType: 'other', tagIds: ['system:悬疑'] })).toEqual([]);
  } finally { db.close(); }
});

test('treats LIKE characters literally and keeps stable distinct results', async () => {
  const { db, repo } = await setup();
  try {
    expect((await repo.search({ ...all, query: String.raw`50%_完成\记录` })).map(result => result.book.id)).toEqual(['special']);
    expect((await repo.search({ ...all, query: '同名书' })).map(result => result.book.id)).toEqual(['same-a', 'same-b']);
    expect((await repo.search(all)).map(result => result.book.id)).toEqual(['one', 'two', 'special', 'same-a', 'same-b']);
  } finally { db.close(); }
});
