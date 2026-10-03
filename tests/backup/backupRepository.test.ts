import { SqliteBackupRepository } from '../../src/backup/backupRepository';
import { migrateDatabase, type Database } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';
import { makeValidManifest } from './backupFixtures';
import { SqliteBookRepository } from '../../src/books/sqliteRepository';

const TABLES = [
  'books', 'book_protagonists', 'tags', 'book_tags', 'quick_tags', 'reading_sessions',
  'image_assets', 'notes', 'note_images', 'highlight_images',
] as const;

async function clearLibrary(db: Database): Promise<void> {
  await db.execAsync(`
    DELETE FROM note_images; DELETE FROM highlight_images; DELETE FROM notes; DELETE FROM image_assets;
    DELETE FROM reading_sessions; DELETE FROM quick_tags; DELETE FROM book_tags; DELETE FROM tags;
    DELETE FROM book_protagonists; DELETE FROM books;
  `);
}

async function dump(db: Database): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {};
  for (const table of TABLES) result[table] = await db.getAllAsync(`SELECT * FROM ${table} ORDER BY rowid`);
  return result;
}

async function seedCompleteLibrary(db: Database): Promise<void> {
  await db.execAsync(`
    INSERT INTO books (id, title, author, status, created_at, updated_at, rating_half_stars, type, legacy_read_count)
      VALUES ('book-b', '第二本', '乙', 'want_to_read', '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z', NULL, 'other', 0);
    INSERT INTO books (id, title, author, status, created_at, updated_at, rating_half_stars, type, legacy_read_count)
      VALUES ('book-a', '第一本', '甲', 'finished', '2026-09-01T00:00:00.000Z', '2026-09-03T00:00:00.000Z', 10, 'romance_male_male', 1);
    INSERT INTO book_protagonists VALUES ('book-a', 1, '主角二');
    INSERT INTO book_protagonists VALUES ('book-a', 0, '主角一');
    INSERT INTO tags VALUES ('tag-system', '仙侠', 1);
    INSERT INTO tags VALUES ('tag-custom', '自定义', 0);
    INSERT INTO book_tags VALUES ('book-a', 'tag-custom', 1);
    INSERT INTO book_tags VALUES ('book-a', 'tag-system', 0);
    INSERT INTO quick_tags VALUES ('tag-custom', 1);
    INSERT INTO quick_tags VALUES ('tag-system', 0);
    INSERT INTO reading_sessions VALUES ('session-2', 'book-a', 2, '2026-09-03', '2026-09-04', 'finished');
    INSERT INTO reading_sessions VALUES ('session-1', 'book-a', 1, '2026-09-01', '2026-09-02', 'finished');
    INSERT INTO image_assets VALUES ('image-1', 'book-a', 'file:///library/shared.jpeg', '2026-09-02T12:00:00.000Z');
    INSERT INTO notes (id, book_id, body, created_at, updated_at, reading_session_id) VALUES ('note-1', 'book-a', '想法', '2026-09-02T13:00:00.000Z', '2026-09-02T13:30:00.000Z', 'session-1');
    INSERT INTO note_images VALUES ('note-1', 'image-1', 0);
    INSERT INTO highlight_images VALUES ('book-a', 'image-1', 0);
  `);
}

describe('SqliteBackupRepository', () => {
  let db: ReturnType<typeof createInMemoryDatabase>;
  let repository: SqliteBackupRepository;

  beforeEach(async () => {
    db = createInMemoryDatabase();
    await migrateDatabase(db);
    await clearLibrary(db);
    repository = new SqliteBackupRepository(db);
  });

  afterEach(() => db.close());

  test('creates a complete stable snapshot and emits a shared image source once', async () => {
    await seedCompleteLibrary(db);

    const snapshot = await repository.createSnapshot('1.2.3', '2026-10-02T12:00:00.000Z');

    expect(snapshot).toEqual({
      formatVersion: 4,
      exportedAt: '2026-10-02T12:00:00.000Z',
      appVersion: '1.2.3',
      data: {
        books: [
          { id: 'book-a', title: '第一本', author: '甲', status: 'finished', bookType: 'romance_male_male', ratingHalfStars: 10, legacyReadCount: 1, coverImageId: null, whyWantToRead: null, platform: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' },
          { id: 'book-b', title: '第二本', author: '乙', status: 'want_to_read', bookType: 'other', ratingHalfStars: null, legacyReadCount: 0, coverImageId: null, whyWantToRead: null, platform: null, createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' },
        ],
        protagonists: [
          { bookId: 'book-a', position: 0, name: '主角一' },
          { bookId: 'book-a', position: 1, name: '主角二' },
        ],
        tags: [
          { id: 'tag-custom', name: '自定义', isSystem: false },
          { id: 'tag-system', name: '仙侠', isSystem: true },
        ],
        bookTags: [
          { bookId: 'book-a', tagId: 'tag-system', position: 0 },
          { bookId: 'book-a', tagId: 'tag-custom', position: 1 },
        ],
        quickTags: [
          { tagId: 'tag-system', position: 0 },
          { tagId: 'tag-custom', position: 1 },
        ],
        readingSessions: [
          { id: 'session-1', bookId: 'book-a', ordinal: 1, startedOn: '2026-09-01', endedOn: '2026-09-02', outcome: 'finished' },
          { id: 'session-2', bookId: 'book-a', ordinal: 2, startedOn: '2026-09-03', endedOn: '2026-09-04', outcome: 'finished' },
        ],
        notes: [{ id: 'note-1', bookId: 'book-a', body: '想法', createdAt: '2026-09-02T13:00:00.000Z', updatedAt: '2026-09-02T13:30:00.000Z', readingSessionId: 'session-1', sourceKind: 'app', originalRecordedOn: null, originalRecordedTime: null }],
        noteImages: [{ noteId: 'note-1', imageId: 'image-1', position: 0 }],
        highlightImages: [{ bookId: 'book-a', imageId: 'image-1', position: 0 }],
      },
      images: [{
        id: 'image-1', bookId: 'book-a', createdAt: '2026-09-02T12:00:00.000Z', extension: 'jpeg',
        localPath: 'file:///library/shared.jpeg', archivePath: 'images/image-1.jpeg',
      }],
    });
    expect(await repository.getOverview()).toEqual({
      books: 2, protagonists: 2, tags: 2, bookTags: 2, quickTags: 2,
      readingSessions: 2, notes: 1, noteImages: 1, highlightImages: 1, images: 1,
    });
  });

  test('new snapshots exclude a book and its images after repository deletion', async () => {
    await seedCompleteLibrary(db);
    const queue = { enqueue: jest.fn(async () => undefined), drain: jest.fn(async () => undefined) };
    const books = new SqliteBookRepository(db, undefined, undefined, undefined, queue as never);
    const before = await repository.createSnapshot('1.2.3', '2026-10-02T12:00:00.000Z');
    expect(before.data.books.map(book => book.id)).toEqual(['book-a', 'book-b']);
    await books.delete('book-a');

    const after = await repository.createSnapshot('1.2.3', '2026-10-02T13:00:00.000Z');

    expect(after.data.books.map(book => book.id)).toEqual(['book-b']);
    expect(after.images).toEqual([]);
    expect(after.data.notes).toEqual([]);
    expect(after.data.highlightImages).toEqual([]);
  });

  test('replaces every library table in one transaction and preserves schema version', async () => {
    await db.execAsync(`
      INSERT INTO books (id, title, author, status, created_at, updated_at, rating_half_stars, type, legacy_read_count)
        VALUES ('old', '旧书', NULL, 'want_to_read', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL, NULL, 0);
      INSERT INTO image_assets VALUES ('old-image', 'old', 'file:///old.jpg', '2026-01-01T00:00:00.000Z');
    `);

    const oldPaths = await repository.replaceAll(makeValidManifest(), new Map([['image-1', 'file:///restored/image-1.jpg']]));

    expect(oldPaths).toEqual(['file:///old.jpg']);
    expect(await db.getAllAsync('SELECT id, title FROM books')).toEqual([{ id: 'book-1', title: '长夜' }]);
    expect(await db.getAllAsync('SELECT id, local_path FROM image_assets')).toEqual([{ id: 'image-1', local_path: 'file:///restored/image-1.jpg' }]);
    expect(await db.getAllAsync('SELECT note_id, image_id FROM note_images')).toEqual([{ note_id: 'note-1', image_id: 'image-1' }]);
    expect(await db.getAllAsync('SELECT book_id, image_id FROM highlight_images')).toEqual([{ book_id: 'book-1', image_id: 'image-1' }]);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 10 });
  });

  test('round-trips optional book details through snapshot and restore', async () => {
    await seedCompleteLibrary(db);
    await db.runAsync('UPDATE books SET why_want_to_read = ?, platform = ? WHERE id = ?', '朋友推荐', '晋江文学城', 'book-b');
    const snapshot = await repository.createSnapshot('1.2.3', '2026-10-02T12:00:00.000Z');
    expect(snapshot.data.books.find(book => book.id === 'book-b')).toMatchObject({ whyWantToRead: '朋友推荐', platform: '晋江文学城' });
    const counts = await repository.getOverview();
    await repository.replaceAll({
      formatVersion: 4,
      exportedAt: snapshot.exportedAt,
      appVersion: snapshot.appVersion,
      counts,
      ...snapshot.data,
      images: snapshot.images.map(({ localPath: _localPath, ...image }) => ({ ...image, byteLength: 4 })),
    } as any, new Map([['image-1', 'file:///restored/image-1.jpg']]));
    expect(await db.getFirstAsync('SELECT why_want_to_read, platform FROM books WHERE id = ?', 'book-b')).toEqual({
      why_want_to_read: '朋友推荐', platform: '晋江文学城',
    });
  });

  test('rolls back every table when replacement fails in the middle', async () => {
    await seedCompleteLibrary(db);
    const before = await dump(db);
    await db.execAsync("CREATE TRIGGER reject_new_note BEFORE INSERT ON notes WHEN NEW.id = 'note-1' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");

    await expect(repository.replaceAll(makeValidManifest(), new Map([['image-1', 'file:///restored/image-1.jpg']]))).rejects.toThrow('injected failure');

    expect(await dump(db)).toEqual(before);
  });

  test('rejects replacement when a restored image path is missing', async () => {
    await expect(repository.replaceAll(makeValidManifest(), new Map())).rejects.toThrow('缺少恢复图片');
    expect(await db.getAllAsync('SELECT * FROM books')).toEqual([]);
  });
});
