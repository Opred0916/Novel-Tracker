import type { Database } from '../storage/database';
import { BACKUP_FORMAT_VERSION, CURRENT_BACKUP_FORMAT_VERSION, type BackupCounts, type BackupDataCollections, type BackupManifestV1 } from './backupTypes';
import { validateBackupManifest } from './backupValidation';

export type BackupImageSource = {
  id: string;
  bookId: string;
  createdAt: string;
  extension: string;
  localPath: string;
  archivePath: string;
};

export type BackupSnapshot = {
  formatVersion: typeof BACKUP_FORMAT_VERSION | typeof CURRENT_BACKUP_FORMAT_VERSION;
  exportedAt: string;
  appVersion: string;
  data: BackupDataCollections;
  images: BackupImageSource[];
};

type BookRow = {
  id: string; title: string; author: string | null; status: BackupManifestV1['books'][number]['status'];
  type: BackupManifestV1['books'][number]['bookType']; rating_half_stars: number | null; legacy_read_count: number;
  created_at: string; updated_at: string;
  cover_image_id: string | null;
};
type ProtagonistRow = { book_id: string; position: number; name: string };
type TagRow = { id: string; name: string; is_system: number };
type BookTagRow = { book_id: string; tag_id: string; position: number };
type QuickTagRow = { tag_id: string; position: number };
type SessionRow = { id: string; book_id: string; ordinal: number; started_on: string; ended_on: string | null; outcome: 'reading' | 'finished' | 'dropped' };
type NoteRow = { id: string; book_id: string; body: string; created_at: string; updated_at: string; reading_session_id: string | null };
type NoteImageRow = { note_id: string; image_id: string; position: number };
type HighlightImageRow = { book_id: string; image_id: string; position: number };
type ImageRow = { id: string; book_id: string; local_path: string; created_at: string };
type CountRow = { count: number };

const extensionFromPath = (path: string): string => {
  const match = path.match(/\.([A-Za-z0-9]{1,10})(?:[?#].*)?$/);
  return match?.[1].toLowerCase() ?? 'bin';
};

const archiveFilename = (id: string, extension: string): string => `${encodeURIComponent(id)}.${extension}`;

async function count(db: Database, table: string): Promise<number> {
  return (await db.getFirstAsync<CountRow>(`SELECT COUNT(*) AS count FROM ${table}`))?.count ?? 0;
}

export class SqliteBackupRepository {
  constructor(private readonly db: Database) {}

  async getOverview(): Promise<BackupCounts> {
    const [books, protagonists, tags, bookTags, quickTags, readingSessions, notes, noteImages, highlightImages, images] = await Promise.all([
      count(this.db, 'books'), count(this.db, 'book_protagonists'), count(this.db, 'tags'), count(this.db, 'book_tags'),
      count(this.db, 'quick_tags'), count(this.db, 'reading_sessions'), count(this.db, 'notes'), count(this.db, 'note_images'),
      count(this.db, 'highlight_images'), count(this.db, 'image_assets'),
    ]);
    return { books, protagonists, tags, bookTags, quickTags, readingSessions, notes, noteImages, highlightImages, images };
  }

  async createSnapshot(appVersion: string, exportedAt: string): Promise<BackupSnapshot> {
    let result: BackupSnapshot | null = null;
    await this.db.withExclusiveTransactionAsync(async txn => {
      const books = await txn.getAllAsync<BookRow>('SELECT * FROM books ORDER BY id ASC');
      const protagonists = await txn.getAllAsync<ProtagonistRow>('SELECT * FROM book_protagonists ORDER BY book_id ASC, position ASC');
      const tags = await txn.getAllAsync<TagRow>('SELECT * FROM tags ORDER BY id ASC');
      const bookTags = await txn.getAllAsync<BookTagRow>('SELECT * FROM book_tags ORDER BY book_id ASC, position ASC, tag_id ASC');
      const quickTags = await txn.getAllAsync<QuickTagRow>('SELECT * FROM quick_tags ORDER BY position ASC, tag_id ASC');
      const sessions = await txn.getAllAsync<SessionRow>('SELECT * FROM reading_sessions ORDER BY book_id ASC, ordinal ASC, id ASC');
      const notes = await txn.getAllAsync<NoteRow>('SELECT * FROM notes ORDER BY book_id ASC, created_at ASC, id ASC');
      const noteImages = await txn.getAllAsync<NoteImageRow>('SELECT * FROM note_images ORDER BY note_id ASC, position ASC, image_id ASC');
      const highlightImages = await txn.getAllAsync<HighlightImageRow>('SELECT * FROM highlight_images ORDER BY book_id ASC, position ASC, image_id ASC');
      const images = await txn.getAllAsync<ImageRow>('SELECT * FROM image_assets ORDER BY id ASC');
      result = {
        formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
        exportedAt,
        appVersion,
        data: {
          books: books.map(row => ({
            id: row.id, title: row.title, author: row.author, status: row.status, bookType: row.type,
            ratingHalfStars: row.rating_half_stars, legacyReadCount: row.legacy_read_count,
            createdAt: row.created_at, updatedAt: row.updated_at, coverImageId: row.cover_image_id,
          })),
          protagonists: protagonists.map(row => ({ bookId: row.book_id, position: row.position, name: row.name })),
          tags: tags.map(row => ({ id: row.id, name: row.name, isSystem: row.is_system === 1 })),
          bookTags: bookTags.map(row => ({ bookId: row.book_id, tagId: row.tag_id, position: row.position })),
          quickTags: quickTags.map(row => ({ tagId: row.tag_id, position: row.position })),
          readingSessions: sessions.map(row => ({ id: row.id, bookId: row.book_id, ordinal: row.ordinal, startedOn: row.started_on, endedOn: row.ended_on, outcome: row.outcome })),
          notes: notes.map(row => ({ id: row.id, bookId: row.book_id, body: row.body, createdAt: row.created_at, updatedAt: row.updated_at, readingSessionId: row.reading_session_id })),
          noteImages: noteImages.map(row => ({ noteId: row.note_id, imageId: row.image_id, position: row.position })),
          highlightImages: highlightImages.map(row => ({ bookId: row.book_id, imageId: row.image_id, position: row.position })),
        },
        images: images.map(row => {
          const extension = extensionFromPath(row.local_path);
          return {
            id: row.id, bookId: row.book_id, createdAt: row.created_at, extension, localPath: row.local_path,
            archivePath: `images/${archiveFilename(row.id, extension)}`,
          };
        }),
      };
    });
    if (result === null) throw new Error('无法创建备份快照');
    return result;
  }

  async replaceAll(manifestInput: BackupManifestV1, restoredImagePaths: ReadonlyMap<string, string>): Promise<string[]> {
    const manifest = validateBackupManifest(manifestInput);
    for (const image of manifest.images) {
      if (!restoredImagePaths.has(image.id)) throw new Error(`缺少恢复图片：${image.id}`);
    }
    let oldPaths: string[] = [];
    await this.db.withExclusiveTransactionAsync(async txn => {
      oldPaths = (await txn.getAllAsync<{ local_path: string }>('SELECT local_path FROM image_assets ORDER BY id ASC')).map(row => row.local_path);
      await txn.execAsync(`
        DELETE FROM note_images; DELETE FROM highlight_images; DELETE FROM notes; DELETE FROM image_assets;
        DELETE FROM reading_sessions; DELETE FROM quick_tags; DELETE FROM book_tags; DELETE FROM tags;
        DELETE FROM book_protagonists; DELETE FROM books;
      `);
      for (const book of manifest.books) await txn.runAsync(
        'INSERT INTO books (id, title, author, status, created_at, updated_at, rating_half_stars, type, legacy_read_count, cover_image_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
        book.id, book.title, book.author, book.status, book.createdAt, book.updatedAt, book.ratingHalfStars, book.bookType, book.legacyReadCount,
      );
      for (const protagonist of manifest.protagonists) await txn.runAsync(
        'INSERT INTO book_protagonists (book_id, position, name) VALUES (?, ?, ?)', protagonist.bookId, protagonist.position, protagonist.name,
      );
      for (const tag of manifest.tags) await txn.runAsync(
        'INSERT INTO tags (id, name, is_system) VALUES (?, ?, ?)', tag.id, tag.name, tag.isSystem ? 1 : 0,
      );
      for (const relation of manifest.bookTags) await txn.runAsync(
        'INSERT INTO book_tags (book_id, tag_id, position) VALUES (?, ?, ?)', relation.bookId, relation.tagId, relation.position,
      );
      for (const quickTag of manifest.quickTags) await txn.runAsync(
        'INSERT INTO quick_tags (tag_id, position) VALUES (?, ?)', quickTag.tagId, quickTag.position,
      );
      for (const session of manifest.readingSessions) await txn.runAsync(
        'INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES (?, ?, ?, ?, ?, ?)',
        session.id, session.bookId, session.ordinal, session.startedOn, session.endedOn, session.outcome,
      );
      for (const image of manifest.images) await txn.runAsync(
        'INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES (?, ?, ?, ?)',
        image.id, image.bookId, restoredImagePaths.get(image.id)!, image.createdAt,
      );
      for (const book of manifest.books) {
        if ((manifest as unknown as { formatVersion: number }).formatVersion === 2 && book.coverImageId !== undefined && book.coverImageId !== null) {
          await txn.runAsync('UPDATE books SET cover_image_id = ? WHERE id = ?', book.coverImageId, book.id);
        }
      }
      for (const note of manifest.notes) await txn.runAsync(
        'INSERT INTO notes (id, book_id, body, created_at, updated_at, reading_session_id) VALUES (?, ?, ?, ?, ?, ?)',
        note.id, note.bookId, note.body, note.createdAt, note.updatedAt, note.readingSessionId,
      );
      for (const relation of manifest.noteImages) await txn.runAsync(
        'INSERT INTO note_images (note_id, image_id, position) VALUES (?, ?, ?)', relation.noteId, relation.imageId, relation.position,
      );
      for (const relation of manifest.highlightImages) await txn.runAsync(
        'INSERT INTO highlight_images (book_id, image_id, position) VALUES (?, ?, ?)', relation.bookId, relation.imageId, relation.position,
      );
    });
    return oldPaths;
  }
}
