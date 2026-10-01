import { randomUUID } from 'node:crypto';
import { SqliteBookRepository } from '../../src/books/sqliteRepository';
import { migrateDatabase } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

test('created novels remain distinct when they share a title', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID);
    const first = await repo.create({ title: '长夜', status: 'want_to_read' });
    const second = await repo.create({ title: '长夜', status: 'want_to_read' });

    expect(first.id).not.toBe(second.id);
    expect((await repo.list()).map(book => book.title)).toEqual(['长夜', '长夜']);
    expect((await repo.get(first.id))?.status).toBe('want_to_read');
  } finally {
    db.close();
  }
});
