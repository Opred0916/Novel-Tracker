import type * as SQLite from 'expo-sqlite';

export type Database = Pick<SQLite.SQLiteDatabase, 'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync' | 'withExclusiveTransactionAsync'>;

export const SYSTEM_TAG_NAMES = [
  '古代', '现代', '都市', '星际', '架空', '西幻', '玄幻', '仙侠', '校园', '职场', '娱乐圈', '豪门',
  '悬疑', '无限流', '末世', '穿越', '重生', '系统', '快穿', '种田', '哨向', '兽人', '群像',
  '慢热', '轻松', '治愈', '甜', '虐', '酸涩', '强强', '年上', '年下', '竹马竹马', '欢喜冤家',
  '先婚后爱', '双向暗恋', '追妻火葬场', '替身', '白月光', '宿敌', '万人迷', '复仇',
  '权谋', '救赎', '美强惨', '日常向', 'HE', 'BE', 'OE', '短篇', '长篇', '交通发达',
  '荤素搭配', '清水', '大女主', 'ABO', '第一人称', '第二人称', '主攻', '主受', '破镜重圆',
] as const;

export const DEFAULT_QUICK_TAG_NAMES = ['古代', '现代', '悬疑', '群像', '慢热'] as const;

const TYPE_CHECK = "type IN ('romance_male_male', 'romance_female_male', 'romance_female_female', 'no_romance', 'other')";

export async function migrateDatabase(db: Database): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const version = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;

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
        author TEXT,
        type TEXT CHECK (type IS NULL OR ${TYPE_CHECK}),
        legacy_read_count INTEGER NOT NULL DEFAULT 0 CHECK (legacy_read_count IN (0, 1)),
        rating_half_stars INTEGER CHECK (
          rating_half_stars IS NULL OR
          (typeof(rating_half_stars) = 'integer' AND rating_half_stars BETWEEN 1 AND 10)
        ),
        cover_image_id TEXT,
        FOREIGN KEY (cover_image_id) REFERENCES image_assets(id) ON DELETE SET NULL
      );
    `);
  } else {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(books)');
    if (!columns.some(column => column.name === 'author')) {
      await db.execAsync('ALTER TABLE books ADD COLUMN author TEXT');
    }
    if (!columns.some(column => column.name === 'rating_half_stars')) {
      await db.execAsync(`ALTER TABLE books ADD COLUMN rating_half_stars INTEGER CHECK (
        rating_half_stars IS NULL OR
        (typeof(rating_half_stars) = 'integer' AND rating_half_stars BETWEEN 1 AND 10)
      )`);
    }
    if (!columns.some(column => column.name === 'type')) {
      await db.execAsync(`ALTER TABLE books ADD COLUMN type TEXT CHECK (type IS NULL OR ${TYPE_CHECK})`);
    }
    if (!columns.some(column => column.name === 'legacy_read_count')) {
      await db.execAsync('ALTER TABLE books ADD COLUMN legacy_read_count INTEGER NOT NULL DEFAULT 0 CHECK (legacy_read_count IN (0, 1))');
    }
    if (!columns.some(column => column.name === 'cover_image_id')) {
      await db.execAsync('ALTER TABLE books ADD COLUMN cover_image_id TEXT REFERENCES image_assets(id) ON DELETE SET NULL');
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
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      is_system INTEGER NOT NULL CHECK (is_system IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS book_tags (
      book_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (book_id, tag_id),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quick_tags (
      tag_id TEXT PRIMARY KEY NOT NULL,
      position INTEGER NOT NULL,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS reading_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL CHECK (ordinal > 0),
      started_on TEXT NOT NULL,
      ended_on TEXT,
      outcome TEXT NOT NULL CHECK (outcome IN ('reading', 'finished', 'dropped')),
      UNIQUE (book_id, ordinal),
      CHECK ((outcome = 'reading' AND ended_on IS NULL) OR (outcome != 'reading' AND ended_on IS NOT NULL)),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_reading_per_book
      ON reading_sessions(book_id) WHERE outcome = 'reading';
    CREATE TABLE IF NOT EXISTS image_assets (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL,
      local_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS pending_image_deletions (
      local_path TEXT PRIMARY KEY NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reading_session_id TEXT,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (reading_session_id) REFERENCES reading_sessions(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS note_images (
      note_id TEXT NOT NULL,
      image_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      PRIMARY KEY (note_id, image_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (image_id) REFERENCES image_assets(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS highlight_images (
      book_id TEXT NOT NULL,
      image_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      PRIMARY KEY (book_id, image_id),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (image_id) REFERENCES image_assets(id) ON DELETE CASCADE
    );
  `);

  if (version < 4) {
    await db.withExclusiveTransactionAsync(async txn => {
      for (const name of SYSTEM_TAG_NAMES) {
        await txn.runAsync('INSERT OR IGNORE INTO tags (id, name, is_system) VALUES (?, ?, 1)', `system:${name}`, name);
      }
      for (const [position, name] of DEFAULT_QUICK_TAG_NAMES.entries()) {
        await txn.runAsync('INSERT OR IGNORE INTO quick_tags (tag_id, position) VALUES (?, ?)', `system:${name}`, position);
      }
    });
  }
  if (version < 5) {
    await db.runAsync("UPDATE books SET legacy_read_count = 1 WHERE status = 'finished'");
  }
  await db.execAsync('PRAGMA user_version = 8');
}

export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const sqlite = await import('expo-sqlite');
  const db = await sqlite.openDatabaseAsync('novel-tracker.db');
  await migrateDatabase(db);
  return db;
}
