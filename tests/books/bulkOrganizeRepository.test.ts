import { randomUUID } from 'node:crypto';
import { SqliteBookRepository } from '../../src/books/sqliteRepository';
import { SqliteTagRepository } from '../../src/books/tagRepository';
import { migrateDatabase } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';
import { SqliteBulkOrganizeRepository } from '../../src/books/bulkOrganizeRepository';

async function setup() {
  const db = createInMemoryDatabase();
  await migrateDatabase(db);
  const books = new SqliteBookRepository(db, randomUUID);
  const tags = new SqliteTagRepository(db, randomUUID);
  return { db, books, tags, bulk: new SqliteBulkOrganizeRepository(db) };
}

test('previews and atomically applies selected tags and type without touching other books', async () => {
  const { db, books, tags, bulk } = await setup();
  try {
    const ancient = (await tags.list()).find(tag => tag.name === '古代')!;
    const modern = (await tags.list()).find(tag => tag.name === '现代')!;
    const first = await books.create({ title: '甲书', status: 'want_to_read', tagIds: [ancient.id] });
    const second = await books.create({ title: '乙书', status: 'want_to_read' });
    const untouched = await books.create({ title: '丙书', status: 'want_to_read', tagIds: [ancient.id] });
    const beforeUntouched = await books.get(untouched.id);

    const preview = await bulk.preview([first.id, second.id], {
      addTagIds: [modern.id], removeTagIds: [ancient.id], newTags: [], typeChange: { kind: 'set', value: 'other' },
    });
    expect(preview.changedCount).toBe(2);
    const result = await bulk.apply(preview);

    expect(result).toEqual({ changedCount: 2 });
    expect(await books.get(first.id)).toMatchObject({ bookType: 'other', tags: [{ id: modern.id }] });
    expect(await books.get(second.id)).toMatchObject({ bookType: 'other', tags: [{ id: modern.id }] });
    expect(await books.get(untouched.id)).toEqual(beforeUntouched);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM reading_sessions')).toEqual({ count: 0 });
  } finally { db.close(); }
});

test('creates custom tags with the batch and leaves quick tags unchanged', async () => {
  const { db, books, tags, bulk } = await setup();
  try {
    const first = await books.create({ title: '甲书', status: 'want_to_read' });
    const quickBefore = await tags.listQuick();
    const preview = await bulk.preview([first.id], {
      addTagIds: ['custom-1'], removeTagIds: [], newTags: [{ id: 'custom-1', name: '  赛博朋克  ' }], typeChange: { kind: 'keep' },
    });
    await bulk.apply(preview);
    expect(await tags.list()).toEqual(expect.arrayContaining([{ id: 'custom-1', name: '赛博朋克', isSystem: false }]));
    expect(await tags.listQuick()).toEqual(quickBefore);
    expect((await books.get(first.id))?.tags).toEqual([{ id: 'custom-1', name: '赛博朋克', isSystem: false }]);
  } finally { db.close(); }
});

test('rejects a stale preview before changing any selected book', async () => {
  const { db, books, bulk } = await setup();
  try {
    const first = await books.create({ title: '甲书', status: 'want_to_read' });
    const second = await books.create({ title: '乙书', status: 'want_to_read' });
    const preview = await bulk.preview([first.id, second.id], {
      addTagIds: [], removeTagIds: [], newTags: [], typeChange: { kind: 'set', value: 'other' },
    });
    await db.runAsync('UPDATE books SET updated_at = ? WHERE id = ?', 'later', first.id);
    await expect(bulk.apply(preview)).rejects.toThrow('预览已过期');
    expect((await books.get(first.id))?.bookType).toBeNull();
    expect((await books.get(second.id))?.bookType).toBeNull();
  } finally { db.close(); }
});

test('rolls back all books and new tags when a later update fails', async () => {
  const { db, books, bulk } = await setup();
  try {
    const first = await books.create({ title: '甲书', status: 'want_to_read' });
    const second = await books.create({ title: '乙书', status: 'want_to_read' });
    const preview = await bulk.preview([first.id, second.id], {
      addTagIds: ['custom-2'], removeTagIds: [], newTags: [{ id: 'custom-2', name: '新标签' }], typeChange: { kind: 'set', value: 'other' },
    });
    await db.execAsync(`CREATE TRIGGER fail_bulk_second BEFORE UPDATE OF type ON books
      WHEN NEW.id = '${second.id}' BEGIN SELECT RAISE(ABORT, 'injected bulk failure'); END;`);
    await expect(bulk.apply(preview)).rejects.toThrow('injected bulk failure');
    expect(await db.getFirstAsync('SELECT id FROM tags WHERE id = ?', 'custom-2')).toBeNull();
    expect((await books.get(first.id))?.bookType).toBeNull();
    expect((await books.get(second.id))?.bookType).toBeNull();
  } finally { db.close(); }
});

test('reads more than one parameter batch while keeping one preview', async () => {
  const { db, bulk } = await setup();
  try {
    const ids = Array.from({ length: 405 }, (_, index) => `bulk-${index}`);
    for (const id of ids) {
      await db.runAsync('INSERT INTO books (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, id, 'want_to_read', 'a', id);
    }
    const preview = await bulk.preview(ids, { addTagIds: [], removeTagIds: [], newTags: [], typeChange: { kind: 'keep' } });
    expect(preview.selectedCount).toBe(405);
    expect(preview.unchangedCount).toBe(405);
  } finally { db.close(); }
});

