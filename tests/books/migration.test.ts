import { migrateDatabase } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

test('upgrades a first-version database without replacing its book', async () => {
  const db = createInMemoryDatabase();
  try {
    await db.execAsync(`
      CREATE TABLE books (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO books VALUES ('old-id', '长夜', 'reading', '2026-09-29T10:00:00.000Z', '2026-09-29T11:00:00.000Z');
    `);

    await migrateDatabase(db);

    expect(await db.getFirstAsync('SELECT id, title, status, created_at, updated_at, author, rating_half_stars FROM books')).toEqual({
      id: 'old-id',
      title: '长夜',
      status: 'reading',
      created_at: '2026-09-29T10:00:00.000Z',
      updated_at: '2026-09-29T11:00:00.000Z',
      author: null,
      rating_half_stars: null,
    });
    expect(await db.getAllAsync('SELECT * FROM book_protagonists')).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 12 });
    expect((await db.getAllAsync<{ name: string }>('PRAGMA table_info(books)')).map(column => column.name)).toContain('cover_image_id');
    expect(await db.getAllAsync('PRAGMA foreign_key_list(books)')).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'image_assets', on_delete: 'SET NULL' }),
    ]));

    await migrateDatabase(db);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM books')).toEqual({ count: 1 });
  } finally {
    db.close();
  }
});

test('upgrades a second-version database without changing details or protagonists', async () => {
  const db = createInMemoryDatabase();
  try {
    await db.execAsync(`
      CREATE TABLE books (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        author TEXT
      );
      CREATE TABLE book_protagonists (
        book_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT NOT NULL,
        PRIMARY KEY (book_id, position),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );
      INSERT INTO books VALUES ('old-id', '长夜', 'finished', '2026-09-29T10:00:00.000Z', '2026-09-29T11:00:00.000Z', '某作者');
      INSERT INTO book_protagonists VALUES ('old-id', 0, '阿青');
      INSERT INTO book_protagonists VALUES ('old-id', 1, '王五');
      PRAGMA user_version = 2;
    `);

    await migrateDatabase(db);
    await migrateDatabase(db);

    expect(await db.getFirstAsync('SELECT * FROM books')).toEqual({
      id: 'old-id', title: '长夜', status: 'finished', author: '某作者', rating_half_stars: null, type: null, legacy_read_count: 1, cover_image_id: null,
      created_at: '2026-09-29T10:00:00.000Z', updated_at: '2026-09-29T11:00:00.000Z', why_want_to_read: null, platform: null,
    });
    expect(await db.getAllAsync('SELECT position, name FROM book_protagonists ORDER BY position')).toEqual([
      { position: 0, name: '阿青' }, { position: 1, name: '王五' },
    ]);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 12 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM books')).toEqual({ count: 1 });
  } finally {
    db.close();
  }
});

test('creates author and protagonist storage for a new database', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);

    expect((await db.getAllAsync<{ name: string }>('PRAGMA table_info(books)')).map(column => column.name)).toContain('author');
    expect((await db.getAllAsync<{ name: string }>('PRAGMA table_info(books)')).map(column => column.name)).toContain('rating_half_stars');
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'book_protagonists'")).toEqual({
      name: 'book_protagonists',
    });
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 12 });
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes'")).toEqual({ name: 'notes' });
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'image_assets'")).toEqual({ name: 'image_assets' });
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'note_images'")).toEqual({ name: 'note_images' });
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'highlight_images'")).toEqual({ name: 'highlight_images' });
    await expect(db.runAsync(
      "INSERT INTO books (id, title, status, created_at, updated_at, rating_half_stars) VALUES ('bad', '长夜', 'finished', 'a', 'b', ?)",
      1.5,
    )).rejects.toThrow();
  } finally {
    db.close();
  }
});

test('upgrades a rated book to type and tag storage without duplicating presets', async () => {
  const db = createInMemoryDatabase();
  try {
    await db.execAsync(`
      CREATE TABLE books (
        id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, author TEXT,
        rating_half_stars INTEGER
      );
      CREATE TABLE book_protagonists (
        book_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL,
        PRIMARY KEY (book_id, position), FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );
      INSERT INTO books VALUES ('old-id', '长夜', 'finished', 'start', 'updated', '某作者', 9);
      INSERT INTO book_protagonists VALUES ('old-id', 0, '阿青');
      PRAGMA user_version = 3;
    `);

    await migrateDatabase(db);
    await migrateDatabase(db);

    expect(await db.getFirstAsync('SELECT id, title, author, rating_half_stars, type FROM books')).toEqual({
      id: 'old-id', title: '长夜', author: '某作者', rating_half_stars: 9, type: null,
    });
    expect(await db.getFirstAsync('SELECT name FROM book_protagonists')).toEqual({ name: '阿青' });
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 12 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM tags WHERE name = ?', '古代')).toEqual({ count: 1 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM tags WHERE name = ?', '破镜重圆')).toEqual({ count: 1 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM quick_tags')).toEqual({ count: 5 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM book_tags')).toEqual({ count: 0 });
  } finally {
    db.close();
  }
});

test('v9 allows unknown historical dates and stores note provenance columns', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const sessionColumns = await db.getAllAsync<{ name: string; notnull: number }>('PRAGMA table_info(reading_sessions)');
    const noteColumns = await db.getAllAsync<{ name: string; notnull: number; dflt_value: string | null }>('PRAGMA table_info(notes)');
    expect(sessionColumns.find(column => column.name === 'started_on')?.notnull).toBe(0);
    expect(sessionColumns.find(column => column.name === 'ended_on')?.notnull).toBe(0);
    expect(noteColumns).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'source_kind', notnull: 1, dflt_value: "'app'" }),
      expect.objectContaining({ name: 'original_recorded_on', notnull: 0 }),
      expect.objectContaining({ name: 'original_recorded_time', notnull: 0 }),
    ]));
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at) VALUES ('historical', '旧书', 'finished', 'a', 'b')");
    await db.runAsync("INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES ('historical-session', 'historical', 1, NULL, NULL, 'finished')");
    expect(await db.getFirstAsync('SELECT started_on, ended_on FROM reading_sessions WHERE id = ?', 'historical-session'))
      .toEqual({ started_on: null, ended_on: null });
    await expect(db.runAsync("INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES ('bad-reading', 'historical', 2, NULL, '2026-10-02', 'reading')")).rejects.toThrow();
  } finally { db.close(); }
});

test('rebuilds an existing v8 reading session table without losing sessions or note references', async () => {
  const db = createInMemoryDatabase();
  try {
    await db.execAsync(`
      CREATE TABLE books (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE reading_sessions (
        id TEXT PRIMARY KEY NOT NULL, book_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
        started_on TEXT NOT NULL, ended_on TEXT, outcome TEXT NOT NULL,
        UNIQUE (book_id, ordinal), FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        CHECK ((outcome = 'reading' AND ended_on IS NULL) OR (outcome != 'reading' AND ended_on IS NOT NULL))
      );
      CREATE UNIQUE INDEX one_active_reading_per_book ON reading_sessions(book_id) WHERE outcome = 'reading';
      CREATE TABLE notes (id TEXT PRIMARY KEY NOT NULL, book_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, reading_session_id TEXT, FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE, FOREIGN KEY (reading_session_id) REFERENCES reading_sessions(id) ON DELETE SET NULL);
      INSERT INTO books VALUES ('b', '旧书', 'finished', 'a', 'b');
      INSERT INTO reading_sessions VALUES ('s', 'b', 1, '2026-01-01', '2026-01-02', 'finished');
      INSERT INTO notes VALUES ('n', 'b', '旧想法', '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 's');
      PRAGMA user_version = 8;
    `);
    await migrateDatabase(db);
    await db.runAsync("INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES ('unknown', 'b', 2, NULL, NULL, 'finished')");
    expect(await db.getAllAsync('SELECT id, started_on, ended_on FROM reading_sessions ORDER BY ordinal')).toEqual([
      { id: 's', started_on: '2026-01-01', ended_on: '2026-01-02' },
      { id: 'unknown', started_on: null, ended_on: null },
    ]);
    expect(await db.getFirstAsync('SELECT reading_session_id FROM notes WHERE id = ?', 'n')).toEqual({ reading_session_id: 's' });
  } finally { db.close(); }
});

test('marks only legacy finished books as previously read without inventing dated sessions', async () => {
  const db = createInMemoryDatabase();
  try {
    await db.execAsync(`
      CREATE TABLE books (
        id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, author TEXT,
        type TEXT, rating_half_stars INTEGER
      );
      CREATE TABLE tags (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, is_system INTEGER NOT NULL);
      CREATE TABLE book_tags (book_id TEXT NOT NULL, tag_id TEXT NOT NULL, position INTEGER NOT NULL,
        PRIMARY KEY (book_id, tag_id));
      INSERT INTO books VALUES ('finished-old', '旧书', 'finished', 'a', 'b', '某作者', 'romance_male_male', 9);
      INSERT INTO books VALUES ('reading-old', '在读书', 'reading', 'a', 'b', NULL, NULL, NULL);
      INSERT INTO tags VALUES ('tag-1', '古代', 1);
      INSERT INTO book_tags VALUES ('finished-old', 'tag-1', 0);
      PRAGMA user_version = 4;
    `);

    await migrateDatabase(db);
    await migrateDatabase(db);

    expect(await db.getAllAsync('SELECT id, legacy_read_count FROM books ORDER BY id')).toEqual([
      { id: 'finished-old', legacy_read_count: 1 },
      { id: 'reading-old', legacy_read_count: 0 },
    ]);
    expect(await db.getAllAsync('SELECT * FROM reading_sessions')).toEqual([]);
    expect(await db.getFirstAsync('SELECT title, author, type, rating_half_stars FROM books WHERE id = ?', 'finished-old')).toEqual({
      title: '旧书', author: '某作者', type: 'romance_male_male', rating_half_stars: 9,
    });
    expect(await db.getFirstAsync('SELECT tag_id FROM book_tags WHERE book_id = ?', 'finished-old')).toEqual({ tag_id: 'tag-1' });
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 12 });
  } finally {
    db.close();
  }
});

test('adds nullable motivation and platform columns while preserving existing books', async () => {
  const db = createInMemoryDatabase();
  try {
    await db.execAsync(`
      CREATE TABLE books (
        id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO books VALUES ('legacy', '旧书', 'want_to_read', 'a', 'b');
      PRAGMA user_version = 9;
    `);
    await migrateDatabase(db);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 12 });
    expect(await db.getFirstAsync('SELECT title, why_want_to_read, platform FROM books WHERE id = ?', 'legacy'))
      .toEqual({ title: '旧书', why_want_to_read: null, platform: null });
  } finally { db.close(); }
});
