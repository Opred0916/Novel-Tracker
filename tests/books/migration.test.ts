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

    expect(await db.getFirstAsync('SELECT id, title, status, created_at, updated_at, author FROM books')).toEqual({
      id: 'old-id',
      title: '长夜',
      status: 'reading',
      created_at: '2026-09-29T10:00:00.000Z',
      updated_at: '2026-09-29T11:00:00.000Z',
      author: null,
    });
    expect(await db.getAllAsync('SELECT * FROM book_protagonists')).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 2 });

    await migrateDatabase(db);
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
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'book_protagonists'")).toEqual({
      name: 'book_protagonists',
    });
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 2 });
  } finally {
    db.close();
  }
});
