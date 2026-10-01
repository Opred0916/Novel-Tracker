import type * as SQLite from 'expo-sqlite';

export type Database = Pick<SQLite.SQLiteDatabase, 'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync' | 'withExclusiveTransactionAsync'>;

export async function migrateDatabase(db: Database): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const booksTable = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'books'",
  );
  if (!booksTable) {
    await db.execAsync(`
      CREATE TABLE books (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        author TEXT
      );
    `);
  } else {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(books)');
    if (!columns.some(column => column.name === 'author')) {
      await db.execAsync('ALTER TABLE books ADD COLUMN author TEXT');
    }
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS book_protagonists (
      book_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (book_id, position),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
    PRAGMA user_version = 2;
  `);
}

export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const sqlite = await import('expo-sqlite');
  const db = await sqlite.openDatabaseAsync('novel-tracker.db');
  await migrateDatabase(db);
  return db;
}
