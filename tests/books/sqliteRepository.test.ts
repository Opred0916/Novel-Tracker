import { randomUUID } from 'node:crypto';
import { SqliteBookRepository } from '../../src/books/sqliteRepository';
import { SqliteTagRepository } from '../../src/books/tagRepository';
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
    expect(first).toMatchObject({ author: null, protagonists: [], ratingHalfStars: null });
  } finally {
    db.close();
  }
});

test('persists book type and multiple tags through create and update', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const tags = new SqliteTagRepository(db, randomUUID);
    const selected = (await tags.list()).filter(tag => ['古代', '悬疑'].includes(tag.name));
    const repo = new SqliteBookRepository(db, randomUUID);
    const book = await repo.create({ title: '长夜', status: 'want_to_read', bookType: 'romance_male_male', tagIds: selected.map(tag => tag.id) });
    expect((await repo.get(book.id))?.tags.map(tag => tag.name)).toEqual(['古代', '悬疑']);
    expect((await repo.get(book.id))?.bookType).toBe('romance_male_male');
    await repo.update(book.id, { title: book.title, author: null, status: book.status, protagonists: [], bookType: 'other', tagIds: [selected[1].id] });
    expect((await repo.list())[0]).toMatchObject({ bookType: 'other', tags: [{ name: '悬疑' }] });
  } finally {
    db.close();
  }
});

test('creates a custom tag only within a successful book update', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID);
    const book = await repo.create({ title: '长夜', status: 'want_to_read' });
    const edit = {
      title: '新长夜', author: null, status: 'want_to_read' as const, protagonists: [],
      tagIds: ['custom-1'], newTags: [{ id: 'custom-1', name: '赛博朋克' }],
    };
    await db.execAsync(`CREATE TRIGGER fail_new_book_tag BEFORE INSERT ON book_tags
      WHEN NEW.tag_id = 'custom-1' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`);
    await expect(repo.update(book.id, edit)).rejects.toThrow('injected failure');
    expect(await db.getFirstAsync('SELECT id FROM tags WHERE id = ?', 'custom-1')).toBeNull();
    expect((await repo.get(book.id))?.title).toBe('长夜');
    await db.execAsync('DROP TRIGGER fail_new_book_tag');
    const updated = await repo.update(book.id, edit);
    expect(updated.tags).toMatchObject([{ id: 'custom-1', name: '赛博朋克', isSystem: false }]);
  } finally {
    db.close();
  }
});

test('creates a finished novel with trimmed details and a half-star rating', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID);
    const book = await repo.create({
      title: ' 长夜 ', author: ' 某作者 ', status: 'finished',
      protagonists: [' 阿青 ', '', '李,四', ' 王五 '], ratingHalfStars: 9,
    });

    expect(book).toMatchObject({
      title: '长夜', author: '某作者', status: 'finished',
      protagonists: ['阿青', '李,四', '王五'], ratingHalfStars: 9,
    });
    expect(await repo.get(book.id)).toEqual(book);
    expect(await repo.list()).toEqual([book]);
    expect(await db.getAllAsync('SELECT position, name FROM book_protagonists ORDER BY position')).toEqual([
      { position: 0, name: '阿青' }, { position: 1, name: '李,四' }, { position: 2, name: '王五' },
    ]);
  } finally {
    db.close();
  }
});

test('rejects invalid creation data without writing a partial book', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID);
    const valid = { title: '长夜', status: 'finished' as const };
    for (const ratingHalfStars of [0, 1.5, 11, Number.NaN]) {
      await expect(repo.create({ ...valid, ratingHalfStars })).rejects.toThrow();
    }
    await expect(repo.create({ ...valid, title: '   ' })).rejects.toThrow('请输入书名');
    await expect(repo.create({ ...valid, status: 'invalid' as never })).rejects.toThrow('阅读状态无效');
    await expect(repo.create({ ...valid, status: 'reading', ratingHalfStars: 9 })).rejects.toThrow();
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM books')).toEqual({ count: 0 });
  } finally {
    db.close();
  }
});

test('rolls back a new book when a protagonist insertion fails', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID);
    await db.execAsync(`
      CREATE TRIGGER fail_new_protagonist BEFORE INSERT ON book_protagonists
      WHEN NEW.name = '出错' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;
    `);

    await expect(repo.create({
      title: '长夜', author: '某作者', status: 'finished',
      protagonists: ['阿青', '出错'], ratingHalfStars: 9,
    })).rejects.toThrow('injected failure');
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM books')).toEqual({ count: 0 });
    expect(await db.getAllAsync('SELECT * FROM book_protagonists')).toEqual([]);
  } finally {
    db.close();
  }
});
