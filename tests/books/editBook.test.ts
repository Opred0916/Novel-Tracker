import { randomUUID } from 'node:crypto';
import { SqliteBookRepository } from '../../src/books/sqliteRepository';
import { migrateDatabase } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

async function setup() {
  const db = createInMemoryDatabase();
  await migrateDatabase(db);
  return { db, repo: new SqliteBookRepository(db, randomUUID) };
}

test('new novels have no author or protagonists until edited', async () => {
  const { db, repo } = await setup();
  try {
    const book = await repo.create({ title: '长夜', status: 'want_to_read' });
    expect(book.author).toBeNull();
    expect(book.protagonists).toEqual([]);
    expect(book.ratingHalfStars).toBeNull();
    expect(await repo.get(book.id)).toMatchObject({ author: null, protagonists: [], ratingHalfStars: null });
  } finally {
    db.close();
  }
});

test('preserves, clears and changes ratings only for allowed status transitions', async () => {
  const { db, repo } = await setup();
  try {
    const original = await repo.create({ title: '长夜', status: 'finished', ratingHalfStars: 9 });
    const details = { title: '长夜', author: null, protagonists: [] };
    const rereading = await repo.update(original.id, { ...details, status: 'reading' });
    expect(rereading.ratingHalfStars).toBe(9);
    expect(rereading.createdAt).toBe(original.createdAt);

    await expect(repo.update(original.id, {
      ...details, status: 'reading', ratingHalfStars: 10,
    })).rejects.toThrow();
    expect((await repo.get(original.id))?.ratingHalfStars).toBe(9);

    const cleared = await repo.update(original.id, { ...details, status: 'reading', ratingHalfStars: null });
    expect(cleared.ratingHalfStars).toBeNull();
    const scored = await repo.update(original.id, { ...details, status: 'finished', ratingHalfStars: 1 });
    expect(scored.ratingHalfStars).toBe(1);
    expect(await repo.get(original.id)).toEqual(scored);
  } finally {
    db.close();
  }
});

test('edits novel details and keeps ordered nonblank protagonist names after reload', async () => {
  const { db, repo } = await setup();
  try {
    const original = await repo.create({ title: '长夜', status: 'want_to_read' });
    const edited = await repo.update(original.id, {
      title: ' 新长夜 ',
      author: ' 某作者 ',
      status: 'reading',
      protagonists: [' 阿青 ', '', '李,四', ' 王五 '],
    });

    expect(edited).toMatchObject({
      id: original.id,
      title: '新长夜',
      author: '某作者',
      status: 'reading',
      protagonists: ['阿青', '李,四', '王五'],
      createdAt: original.createdAt,
    });
    expect(await repo.get(original.id)).toEqual(edited);
    expect(await repo.list()).toEqual([edited]);
    expect(await db.getAllAsync('SELECT position, name FROM book_protagonists ORDER BY position')).toEqual([
      { position: 0, name: '阿青' },
      { position: 1, name: '李,四' },
      { position: 2, name: '王五' },
    ]);
  } finally {
    db.close();
  }
});

test('preserves omitted optional details and clears them only when explicitly blank', async () => {
  const { db, repo } = await setup();
  try {
    const original = await repo.create({ title: '长夜', status: 'want_to_read', whyWantToRead: '封面好看', platform: '晋江文学城' });
    const preserved = await repo.update(original.id, { title: '长夜', author: null, status: 'want_to_read', protagonists: [] });
    expect(preserved).toMatchObject({ whyWantToRead: '封面好看', platform: '晋江文学城' });
    const cleared = await repo.update(original.id, {
      title: '长夜', author: null, status: 'want_to_read', protagonists: [], whyWantToRead: '  ', platform: null,
    });
    expect(cleared).toMatchObject({ whyWantToRead: null, platform: null });
  } finally { db.close(); }
});

test('rejects blank title and invalid status without changing the stored novel', async () => {
  const { db, repo } = await setup();
  try {
    const original = await repo.create({ title: '长夜', status: 'want_to_read' });
    await expect(repo.update(original.id, {
      title: '  ', author: null, status: 'reading', protagonists: [],
    })).rejects.toThrow('请输入书名');
    await expect(repo.update(original.id, {
      title: '新长夜', author: null, status: 'invalid' as never, protagonists: [],
    })).rejects.toThrow();
    expect(await repo.get(original.id)).toEqual(original);
  } finally {
    db.close();
  }
});

test('rejects an unknown novel ID', async () => {
  const { db, repo } = await setup();
  try {
    await expect(repo.update('missing', {
      title: '长夜', author: null, status: 'reading', protagonists: [],
    })).rejects.toThrow();
  } finally {
    db.close();
  }
});

test('rolls back both novel fields and protagonists when insertion fails', async () => {
  const { db, repo } = await setup();
  try {
    const created = await repo.create({ title: '长夜', status: 'want_to_read' });
    const original = await repo.update(created.id, {
      title: '长夜', author: '原作者', status: 'finished', protagonists: ['旧主角'], ratingHalfStars: 9,
    });
    await db.execAsync(`
      CREATE TRIGGER fail_protagonist_insert BEFORE INSERT ON book_protagonists
      WHEN NEW.name = '出错' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;
    `);

    await expect(repo.update(created.id, {
      title: '不应保存', author: '新作者', status: 'finished', protagonists: ['出错'], ratingHalfStars: 10,
    })).rejects.toThrow('injected failure');
    expect(await repo.get(created.id)).toEqual(original);
  } finally {
    db.close();
  }
});
