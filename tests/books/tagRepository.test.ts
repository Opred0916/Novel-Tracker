import { randomUUID } from 'node:crypto';
import { SqliteTagRepository } from '../../src/books/tagRepository';
import { migrateDatabase } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

test('creates unique custom tags and changes quick tags without deleting book tags', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const tags = new SqliteTagRepository(db, randomUUID);
    const created = await tags.create('  赛博朋克  ');
    expect(created).toMatchObject({ name: '赛博朋克', isSystem: false });
    await expect(tags.create('赛博朋克')).rejects.toThrow();
    await expect(tags.create('   ')).rejects.toThrow();
    expect((await tags.list()).some(tag => tag.id === created.id)).toBe(true);
    await tags.setQuick([created.id]);
    expect((await tags.listQuick()).map(tag => tag.name)).toEqual(['赛博朋克']);
    await tags.setQuick([]);
    expect(await tags.listQuick()).toEqual([]);
    expect((await tags.list()).some(tag => tag.id === created.id)).toBe(true);
  } finally {
    db.close();
  }
});
