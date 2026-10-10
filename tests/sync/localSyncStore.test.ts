import { SqliteBackupRepository } from '../../src/backup/backupRepository';
import { migrateDatabase } from '../../src/storage/database';
import { LocalSyncStore } from '../../src/sync/localSyncStore';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';
import { makeEmptyManifest } from '../backup/backupFixtures';

test('synced-table writes advance local revision and the baseline persists', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const store = new LocalSyncStore(db);
    const before = await store.readLocalRevision();
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at) VALUES ('a','A','want_to_read','2026-10-10T00:00:00.000Z','2026-10-10T00:00:00.000Z')");
    await db.runAsync("INSERT INTO notes (id, book_id, body, created_at, updated_at) VALUES ('n','a','note','now','now')");
    expect(await store.readLocalRevision()).toBe(before + 2);
    await store.saveBaseline(4, '{"formatVersion":4}');
    expect(await store.readBaseline()).toEqual({ remoteRevision: 4, manifestJson: '{"formatVersion":4}' });
  } finally { db.close(); }
});

test('a stale revision cannot replace a changed library', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const store = new LocalSyncStore(db);
    const expected = await store.readLocalRevision();
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at) VALUES ('a','A','want_to_read','2026-10-10T00:00:00.000Z','2026-10-10T00:00:00.000Z')");
    const repository = new SqliteBackupRepository(db);
    await expect(repository.replaceAll(makeEmptyManifest(), new Map(), expected)).rejects.toThrow('本地书库已变化');
    expect((await db.getAllAsync<{ id: string }>('SELECT id FROM books')).map(row => row.id)).toEqual(['a']);
  } finally { db.close(); }
});
