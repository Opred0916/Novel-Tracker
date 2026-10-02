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
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });

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
      id: 'old-id', title: '长夜', status: 'finished', author: '某作者', rating_half_stars: null, type: null, legacy_read_count: 1,
      created_at: '2026-09-29T10:00:00.000Z', updated_at: '2026-09-29T11:00:00.000Z',
    });
    expect(await db.getAllAsync('SELECT position, name FROM book_protagonists ORDER BY position')).toEqual([
      { position: 0, name: '阿青' }, { position: 1, name: '王五' },
    ]);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
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
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
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
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM tags WHERE name = ?', '古代')).toEqual({ count: 1 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM tags WHERE name = ?', '破镜重圆')).toEqual({ count: 1 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM quick_tags')).toEqual({ count: 5 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM book_tags')).toEqual({ count: 0 });
  } finally {
    db.close();
  }
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
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
  } finally {
    db.close();
  }
});
