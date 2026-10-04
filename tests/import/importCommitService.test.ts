import { randomUUID } from 'node:crypto';
import { migrateDatabase } from '../../src/storage/database';
import { ImportCommitService } from '../../src/import/importCommitService';
import { parseTextImport } from '../../src/import/textImportParser';
import type { ImportReview } from '../../src/import/importReview';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

function makeReview(text: string, action: 'create' | 'append_notes' | 'skip' = 'create'): ImportReview {
  const candidate = parseTextImport(text, 'blocks', 'want_to_read').candidates[0];
  return { items: [{ candidate, action, targetBookId: action === 'append_notes' ? 'existing' : null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] }], fragments: [], fragmentDecisions: {} };
}

test('creates imported books, unknown-date sessions, and provenance-aware notes in one transaction', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const review = makeReview('书名：残次品\n作者：Priest\n状态：已读\n摘记：旧记录\n日期：2024-10-27 12:12');
    const service = new ImportCommitService(db, randomUUID, () => '2026-10-03T10:00:00.000Z');
    await expect(service.commit(review)).resolves.toEqual({ createdBooks: 1, createdNotes: 1, appendedNotes: 0, skippedItems: 0 });
    expect(await db.getFirstAsync('SELECT title, status FROM books')).toEqual({ title: '残次品', status: 'finished' });
    expect(await db.getFirstAsync('SELECT started_on, ended_on FROM reading_sessions')).toEqual({ started_on: null, ended_on: null });
    expect(await db.getFirstAsync('SELECT source_kind, original_recorded_on, original_recorded_time, reading_session_id FROM notes')).toEqual({
      source_kind: 'import', original_recorded_on: '2024-10-27', original_recorded_time: '12:12', reading_session_id: null,
    });
  } finally { db.close(); }
});

test('appends notes only to the selected existing book and rechecks duplicate notes', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at) VALUES ('existing', '残次品', 'want_to_read', 'a', 'b')");
    const service = new ImportCommitService(db, () => 'new-note', () => '2026-10-03T10:00:00.000Z');
    const review = makeReview('书名：残次品\n摘记：新摘记', 'append_notes');
    await expect(service.commit(review)).resolves.toEqual({ createdBooks: 0, createdNotes: 0, appendedNotes: 1, skippedItems: 0 });
    expect(await db.getFirstAsync('SELECT book_id, body FROM notes')).toEqual({ book_id: 'existing', body: '新摘记' });
    await expect(service.commit(review)).rejects.toThrow('摘记重复');
  } finally { db.close(); }
});

test('rolls back all imported rows when a later candidate fails', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    await db.execAsync("CREATE TRIGGER reject_second BEFORE INSERT ON books WHEN NEW.title = '坏书' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
    const first = parseTextImport('书名：好书', 'blocks', 'want_to_read').candidates[0];
    const second = parseTextImport('书名：坏书', 'blocks', 'want_to_read').candidates[0];
    const review: ImportReview = { items: [
      { candidate: first, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] },
      { candidate: second, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] },
    ], fragments: [], fragmentDecisions: {} };
    const service = new ImportCommitService(db, randomUUID, () => '2026-10-03T10:00:00.000Z');
    await expect(service.commit(review)).rejects.toThrow('injected failure');
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM books')).toEqual({ count: 0 });
  } finally { db.close(); }
});

test('requires explicit acknowledgment before creating two same-title books in one batch', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const first = parseTextImport('书名：同名书', 'blocks', 'want_to_read').candidates[0];
    const second = { ...first, id: 'second-candidate', notes: [] };
    const review: ImportReview = { items: [
      { candidate: first, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] },
      { candidate: second, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] },
    ], fragments: [], fragmentDecisions: {} };
    const service = new ImportCommitService(db, randomUUID, () => '2026-10-03T10:00:00.000Z');
    await expect(service.commit(review)).rejects.toThrow('书籍重复');
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM books')).toEqual({ count: 0 });

    review.items[1].acknowledgedDuplicateCandidateIds = [first.id];
    await expect(service.commit(review)).resolves.toEqual({ createdBooks: 2, createdNotes: 0, appendedNotes: 0, skippedItems: 0 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM books')).toEqual({ count: 2 });
  } finally { db.close(); }
});
