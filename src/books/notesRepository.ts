import { randomUUID } from 'expo-crypto';
import type { Database } from '../storage/database';
import { findReadingSessionForNote } from './noteAssociation';
import type { ImageAsset, Note, NoteInput } from './types';

type NoteRow = {
  id: string; book_id: string; body: string; created_at: string; updated_at: string; reading_session_id: string | null;
  source_kind: 'app' | 'import'; original_recorded_on: string | null; original_recorded_time: string | null;
};
type ImageRow = { id: string; book_id: string; local_path: string; created_at: string };

const dateOf = (timestamp: string) => timestamp.slice(0, 10);
const fromImage = (row: ImageRow): ImageAsset => ({ id: row.id, bookId: row.book_id, localPath: row.local_path, createdAt: row.created_at });

export class SqliteNotesRepository {
  constructor(private readonly db: Database, private readonly idFactory: () => string = randomUUID) {}

  async registerImage(asset: ImageAsset): Promise<void> {
    await this.db.runAsync('INSERT OR IGNORE INTO image_assets (id, book_id, local_path, created_at) VALUES (?, ?, ?, ?)', asset.id, asset.bookId, asset.localPath, asset.createdAt);
  }

  private async imagesForNote(noteId: string, txn: Database): Promise<ImageAsset[]> {
    const rows = await txn.getAllAsync<ImageRow>(
      'SELECT a.* FROM image_assets a JOIN note_images n ON n.image_id = a.id WHERE n.note_id = ? ORDER BY n.position ASC', noteId,
    );
    return rows.map(fromImage);
  }

  async listNotes(bookId: string): Promise<Note[]> {
    const rows = await this.db.getAllAsync<NoteRow>('SELECT * FROM notes WHERE book_id = ? ORDER BY created_at DESC, id DESC', bookId);
    return Promise.all(rows.map(async row => ({
      id: row.id, bookId: row.book_id, body: row.body, createdAt: row.created_at, updatedAt: row.updated_at,
      readingSessionId: row.reading_session_id, sourceKind: row.source_kind, originalRecordedOn: row.original_recorded_on,
      originalRecordedTime: row.original_recorded_time, images: await this.imagesForNote(row.id, this.db),
    })));
  }

  async createNote(bookId: string, input: NoteInput): Promise<Note> {
    const body = input.body.trim();
    if (!body) throw new Error('请输入我的想法');
    const id = this.idFactory();
    const createdAt = input.createdAt ?? new Date().toISOString();
    const sourceKind = input.sourceKind ?? 'app';
    const originalRecordedOn = input.originalRecordedOn ?? null;
    const originalRecordedTime = input.originalRecordedTime ?? null;
    let sessionId: string | null = null;
    await this.db.withExclusiveTransactionAsync(async txn => {
      const sessions = await txn.getAllAsync<{ id: string; book_id: string; ordinal: number; started_on: string; ended_on: string | null; outcome: 'reading' | 'finished' | 'dropped' }>(
        'SELECT * FROM reading_sessions WHERE book_id = ? ORDER BY ordinal ASC', bookId,
      );
      const associationDate = sourceKind === 'import' ? originalRecordedOn : dateOf(createdAt);
      sessionId = associationDate
        ? findReadingSessionForNote(associationDate, sessions.map(session => ({
          id: session.id, bookId: session.book_id, ordinal: session.ordinal, startedOn: session.started_on, endedOn: session.ended_on, outcome: session.outcome,
        })))
        : null;
      await txn.runAsync(
        'INSERT INTO notes (id, book_id, body, created_at, updated_at, reading_session_id, source_kind, original_recorded_on, original_recorded_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, bookId, body, createdAt, createdAt, sessionId, sourceKind, originalRecordedOn, originalRecordedTime,
      );
      for (const [position, imageId] of (input.imageIds ?? []).entries()) {
        const image = await txn.getFirstAsync<{ id: string; book_id: string }>('SELECT id, book_id FROM image_assets WHERE id = ?', imageId);
        if (!image || image.book_id !== bookId) throw new Error('图片不存在');
        await txn.runAsync('INSERT INTO note_images (note_id, image_id, position) VALUES (?, ?, ?)', id, imageId, position);
      }
    });
    const images = await this.imagesForNote(id, this.db);
    return { id, bookId, body, createdAt, updatedAt: createdAt, readingSessionId: sessionId, sourceKind, originalRecordedOn, originalRecordedTime, images };
  }

  async updateNote(bookId: string, noteId: string, input: NoteInput): Promise<Note> {
    const body = input.body.trim();
    if (!body) throw new Error('请输入我的想法');
    const updatedAt = new Date().toISOString();
    await this.db.withExclusiveTransactionAsync(async txn => {
      const note = await txn.getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ? AND book_id = ?', noteId, bookId);
      if (!note) throw new Error('找不到摘记');
      await txn.runAsync('UPDATE notes SET body = ?, updated_at = ? WHERE id = ? AND book_id = ?', body, updatedAt, noteId, bookId);
      await txn.runAsync('DELETE FROM note_images WHERE note_id = ?', noteId);
      for (const [position, imageId] of (input.imageIds ?? []).entries()) {
        await txn.runAsync('INSERT INTO note_images (note_id, image_id, position) VALUES (?, ?, ?)', noteId, imageId, position);
      }
    });
    const note = (await this.listNotes(bookId)).find(item => item.id === noteId);
    if (!note) throw new Error('找不到摘记');
    return note;
  }

  async deleteNote(bookId: string, noteId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async txn => {
      const note = await txn.getFirstAsync<{ id: string }>('SELECT id FROM notes WHERE id = ? AND book_id = ?', noteId, bookId);
      if (!note) throw new Error('找不到摘记');
      await txn.runAsync('DELETE FROM notes WHERE id = ? AND book_id = ?', noteId, bookId);
    });
  }

  async addHighlights(bookId: string, imageIds: string[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async txn => {
      const max = await txn.getFirstAsync<{ position: number | null }>('SELECT MAX(position) AS position FROM highlight_images WHERE book_id = ?', bookId);
      let position = (max?.position ?? -1) + 1;
      for (const imageId of imageIds) {
        await txn.runAsync('INSERT OR IGNORE INTO highlight_images (book_id, image_id, position) VALUES (?, ?, ?)', bookId, imageId, position++);
      }
    });
  }

  async listHighlights(bookId: string): Promise<ImageAsset[]> {
    const rows = await this.db.getAllAsync<ImageRow>('SELECT a.* FROM image_assets a JOIN highlight_images h ON h.image_id = a.id WHERE h.book_id = ? ORDER BY h.position ASC', bookId);
    return rows.map(fromImage);
  }

  async recalculateAssociations(bookId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async txn => {
      const sessions = await txn.getAllAsync<{ id: string; book_id: string; ordinal: number; started_on: string | null; ended_on: string | null; outcome: 'reading' | 'finished' | 'dropped' }>('SELECT * FROM reading_sessions WHERE book_id = ? ORDER BY ordinal ASC', bookId);
      const normalized = sessions.map(session => ({ id: session.id, bookId: session.book_id, ordinal: session.ordinal, startedOn: session.started_on, endedOn: session.ended_on, outcome: session.outcome }));
      const notes = await txn.getAllAsync<{ id: string; created_at: string; source_kind: 'app' | 'import'; original_recorded_on: string | null }>('SELECT id, created_at, source_kind, original_recorded_on FROM notes WHERE book_id = ?', bookId);
      for (const note of notes) {
        const associationDate = note.source_kind === 'import' ? note.original_recorded_on : dateOf(note.created_at);
        await txn.runAsync('UPDATE notes SET reading_session_id = ? WHERE id = ?', associationDate ? findReadingSessionForNote(associationDate, normalized) : null, note.id);
      }
    });
  }

  async removeHighlight(bookId: string, imageId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async txn => {
      await txn.runAsync('DELETE FROM highlight_images WHERE book_id = ? AND image_id = ?', bookId, imageId);
    });
  }
}
