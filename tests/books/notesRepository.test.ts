import { migrateDatabase } from '../../src/storage/database';
import { SqliteNotesRepository } from '../../src/books/notesRepository';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

async function setup() {
  const db = createInMemoryDatabase();
  await migrateDatabase(db);
  await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at) VALUES ('book-1', '长夜', 'finished', 'a', 'b')");
  return db;
}

test('creates a text-only note and lists it newest first', async () => {
  const db = await setup();
  try {
    const repo = new SqliteNotesRepository(db, () => 'note-1');
    const note = await repo.createNote('book-1', { body: '  我的想法  ', createdAt: '2026-03-01T10:00:00.000Z' });
    expect(note.body).toBe('我的想法');
    expect((await repo.listNotes('book-1'))[0]).toMatchObject({ id: 'note-1', body: '我的想法', images: [] });
  } finally { db.close(); }
});

test('rejects a note whose trimmed body is empty', async () => {
  const db = await setup();
  try {
    const repo = new SqliteNotesRepository(db);
    await expect(repo.createNote('book-1', { body: ' \n ' })).rejects.toThrow('请输入我的想法');
  } finally { db.close(); }
});

test('attaches multiple images and keeps an image used by a note after highlight removal', async () => {
  const db = await setup();
  try {
    await db.runAsync("INSERT INTO image_assets VALUES ('image-1', 'book-1', 'file:///one.jpg', '2026-03-01')");
    await db.runAsync("INSERT INTO image_assets VALUES ('image-2', 'book-1', 'file:///two.jpg', '2026-03-01')");
    const repo = new SqliteNotesRepository(db, () => 'note-1');
    await repo.addHighlights('book-1', ['image-1', 'image-2']);
    await repo.createNote('book-1', { body: '想法', imageIds: ['image-1', 'image-2'] });
    await repo.removeHighlight('book-1', 'image-1');
    expect(await db.getFirstAsync('SELECT image_id FROM note_images WHERE note_id = ?', 'note-1')).toEqual({ image_id: 'image-1' });
    expect(await db.getFirstAsync('SELECT image_id FROM highlight_images WHERE book_id = ? AND image_id = ?', 'book-1', 'image-2')).toEqual({ image_id: 'image-2' });
  } finally { db.close(); }
});

test('recalculates note association after reading dates change', async () => {
  const db = await setup();
  try {
    await db.runAsync("INSERT INTO reading_sessions VALUES ('session-1', 'book-1', 1, '2026-03-10', '2026-03-12', 'finished')");
    const repo = new SqliteNotesRepository(db, () => 'note-1');
    await repo.createNote('book-1', { body: '想法', createdAt: '2026-03-05T10:00:00.000Z' });
    expect(await db.getFirstAsync('SELECT reading_session_id FROM notes WHERE id = ?', 'note-1')).toEqual({ reading_session_id: null });
    await db.runAsync("UPDATE reading_sessions SET started_on = '2026-03-01' WHERE id = 'session-1'");
    await repo.recalculateAssociations('book-1');
    expect(await db.getFirstAsync('SELECT reading_session_id FROM notes WHERE id = ?', 'note-1')).toEqual({ reading_session_id: 'session-1' });
  } finally { db.close(); }
});

test('preserves imported note provenance and associates it by the original recorded date', async () => {
  const db = await setup();
  try {
    await db.runAsync("INSERT INTO reading_sessions VALUES ('session-1', 'book-1', 1, '2026-03-10', '2026-03-12', 'finished')");
    const repo = new SqliteNotesRepository(db, () => 'note-imported');
    const note = await repo.createNote('book-1', {
      body: '微博摘记', sourceKind: 'import', originalRecordedOn: '2026-03-11', originalRecordedTime: '21:30',
      createdAt: '2026-10-03T10:00:00.000Z',
    });
    expect(note).toMatchObject({ sourceKind: 'import', originalRecordedOn: '2026-03-11', originalRecordedTime: '21:30', readingSessionId: 'session-1' });
    expect(await db.getFirstAsync('SELECT source_kind, original_recorded_on, original_recorded_time FROM notes WHERE id = ?', 'note-imported'))
      .toEqual({ source_kind: 'import', original_recorded_on: '2026-03-11', original_recorded_time: '21:30' });
  } finally { db.close(); }
});

test('does not guess a reading session for an imported note without an original date', async () => {
  const db = await setup();
  try {
    await db.runAsync("INSERT INTO reading_sessions VALUES ('session-1', 'book-1', 1, '2026-03-10', '2026-03-12', 'finished')");
    const repo = new SqliteNotesRepository(db, () => 'note-undated');
    const note = await repo.createNote('book-1', { body: '没有原始日期', sourceKind: 'import', createdAt: '2026-10-03T10:00:00.000Z' });
    expect(note.readingSessionId).toBeNull();
  } finally { db.close(); }
});
