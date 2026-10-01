import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { SqliteBookRepository } from '../../src/books/sqliteRepository';
import { migrateDatabase } from '../../src/storage/database';

function inMemoryDatabase() {
  const db = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql: string) => { db.exec(sql); },
    runAsync: async (sql: string, ...args: unknown[]) => {
      const result = db.prepare(sql).run(...(args as []));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getAllAsync: async <T>(sql: string, ...args: unknown[]) => db.prepare(sql).all(...(args as [])) as T[],
    getFirstAsync: async <T>(sql: string, ...args: unknown[]) => db.prepare(sql).get(...(args as [])) as T | null,
    withExclusiveTransactionAsync: async (fn: (txn: unknown) => Promise<void>) => { await fn(undefined); },
  };
}

test('created novels remain distinct when they share a title', async () => {
  const db = inMemoryDatabase();
  await migrateDatabase(db);
  const repo = new SqliteBookRepository(db, randomUUID);
  const first = await repo.create({ title: '长夜', status: 'want_to_read' });
  const second = await repo.create({ title: '长夜', status: 'want_to_read' });

  expect(first.id).not.toBe(second.id);
  expect((await repo.list()).map(book => book.title)).toEqual(['长夜', '长夜']);
  expect((await repo.get(first.id))?.status).toBe('want_to_read');
});
