import { DatabaseSync } from 'node:sqlite';
import type * as SQLite from 'expo-sqlite';
import type { Database } from '../../src/storage/database';

export function createInMemoryDatabase(): Database & { close(): void } {
  const raw = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql: string) => { raw.exec(sql); },
    runAsync: async (sql: string, ...args: unknown[]) => {
      const result = raw.prepare(sql).run(...(args as []));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getAllAsync: async <T>(sql: string, ...args: unknown[]) => raw.prepare(sql).all(...(args as [])) as T[],
    getFirstAsync: async <T>(sql: string, ...args: unknown[]) => (raw.prepare(sql).get(...(args as [])) ?? null) as T | null,
    withExclusiveTransactionAsync: async (task: (txn: SQLite.SQLiteDatabase) => Promise<void>) => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        await task(adapter as unknown as SQLite.SQLiteDatabase);
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => raw.close(),
  };
  return adapter as Database & { close(): void };
}
