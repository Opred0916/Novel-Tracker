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
    INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES
      ('image-highlight', 'one', 'file:///managed/highlight.jpg', '2026-10-02T12:00:00Z'),
      ('image-note', 'two', 'file:///managed/note.jpg', '2026-10-01T12:00:00Z'),
      ('image-pending', 'one', 'file:///managed/pending.jpg', '2026-10-03T12:00:00Z'),
      ('image-orphan', 'one', 'file:///managed/orphan.jpg', '2026-10-04T12:00:00Z'),
      ('image-cover', 'one', 'file:///managed/cover.jpg', '2026-10-04T12:00:00Z');
    INSERT INTO highlight_images (book_id, image_id, position) VALUES
      ('one', 'image-highlight', 0), ('one', 'image-pending', 1);
    INSERT INTO note_images (note_id, image_id, position) VALUES ('note-3', 'image-note', 0);
    UPDATE books SET cover_image_id = 'image-cover' WHERE id = 'one';
    INSERT INTO image_ocr (image_id, status, recognized_text, updated_at) VALUES
      ('image-highlight', 'recognized', '剑与月光', '2026-10-02T12:00:00Z'),
      ('image-note', 'recognized', '星河尽头', '2026-10-01T12:00:00Z'),
      ('image-pending', 'pending', '不应被搜到', '2026-10-03T12:00:00Z'),
      ('image-orphan', 'recognized', '孤立截图', '2026-10-04T12:00:00Z'),
      ('image-cover', 'recognized', '封面文字', '2026-10-04T12:00:00Z');
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
    await db.runAsync("INSERT INTO notes (id, book_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      'note-newer', 'one', 'Priest 的故事值得收藏。', '2026-10-03T10:00:00Z', '2026-10-03T10:00:00Z');
    const results = await repo.search({ ...all, query: 'Priest 重读' });
    expect(results).toHaveLength(1);
    expect(results[0].book.id).toBe('one');
    expect(results[0].matchedNoteSnippet).toContain('重读');
  } finally { db.close(); }
});

test('searches recognized image text and returns stable highlight evidence', async () => {
  const { db, repo } = await setup();
  try {
    const results = await repo.search({ ...all, query: '剑与月光' });
    expect(results).toHaveLength(1);
    expect(results[0].matchedImage).toEqual({ imageId: 'image-highlight', source: 'highlight', snippet: '剑与月光' });
    expect(results[0].matchedNoteSnippet).toBeNull();
  } finally { db.close(); }
});

test('searches image text attached only to a note and ignores pending, orphan and cover OCR', async () => {
  const { db, repo } = await setup();
  try {
    expect((await repo.search({ ...all, query: '星河尽头' }))[0].matchedImage).toEqual({ imageId: 'image-note', source: 'note', snippet: '星河尽头' });
    expect(await repo.search({ ...all, query: '不应被搜到' })).toEqual([]);
    expect(await repo.search({ ...all, query: '孤立截图' })).toEqual([]);
    expect(await repo.search({ ...all, query: '封面文字' })).toEqual([]);
  } finally { db.close(); }
});

test('combines metadata and image terms while returning one book result', async () => {
  const { db, repo } = await setup();
  try {
    const results = await repo.search({ ...all, query: 'Priest 剑与月光' });
    expect(results).toHaveLength(1);
    expect(results[0].book.id).toBe('one');
    expect(results[0].matchedImage?.imageId).toBe('image-highlight');
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
