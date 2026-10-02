import { randomUUID } from 'node:crypto';
import { SqliteBookRepository } from '../../src/books/sqliteRepository';
import { SqliteTagRepository } from '../../src/books/tagRepository';
import { migrateDatabase } from '../../src/storage/database';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';
import { ImageDeletionQueue } from '../../src/books/imageDeletionQueue';

function fakeCoverFiles() {
  return {
    copyToBook: jest.fn(async (source: { extension: string }, bookId: string, imageId: string) => ({
      id: imageId, bookId, localPath: `file:///${bookId}/${imageId}.${source.extension}`, createdAt: 'now',
    })),
    discard: jest.fn(async () => undefined),
    removeFile: jest.fn(async () => undefined),
  };
}

function fakeDeletionQueue() {
  return {
    enqueue: jest.fn(async (..._args: unknown[]) => undefined),
    drain: jest.fn(async () => undefined),
  };
}

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
    expect(first).toMatchObject({ author: null, protagonists: [], ratingHalfStars: null, coverImageId: null, coverUri: null });
  } finally {
    db.close();
  }
});

test('hydrates a linked cover image path while keeping books without covers nullable', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      'covered', '有封面', 'want_to_read', 'a', 'b');
    await db.runAsync('INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES (?, ?, ?, ?)',
      'cover-1', 'covered', 'file:///cover.png', 'a');
    await db.runAsync('UPDATE books SET cover_image_id = ? WHERE id = ?', 'cover-1', 'covered');
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      'plain', '无封面', 'want_to_read', 'a', 'c');
    const repo = new SqliteBookRepository(db, randomUUID);
    expect(await repo.get('covered')).toMatchObject({ coverImageId: 'cover-1', coverUri: 'file:///cover.png' });
    expect(await repo.get('plain')).toMatchObject({ coverImageId: null, coverUri: null });
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

test('stores, replaces, and removes a local book cover as one repository operation', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const files = fakeCoverFiles();
    const repo = new SqliteBookRepository(db, randomUUID, undefined, files as never);
    const first = await repo.create({ title: '长夜', status: 'want_to_read', coverSource: { uri: 'file:///stage-a', extension: 'png' } });
    expect(first).toMatchObject({ coverUri: expect.stringContaining('png') });
    expect(await db.getFirstAsync('SELECT cover_image_id FROM books WHERE id = ?', first.id)).toEqual({ cover_image_id: first.coverImageId });
    const second = await repo.update(first.id, {
      title: first.title, author: first.author, status: first.status, protagonists: [],
      coverChange: { kind: 'set', source: { uri: 'file:///stage-b', extension: 'jpg' } },
    });
    expect(second.coverImageId).not.toBe(first.coverImageId);
    expect(files.removeFile).toHaveBeenCalledWith(first.coverUri);
    const removed = await repo.update(second.id, {
      title: second.title, author: second.author, status: second.status, protagonists: [],
      coverChange: { kind: 'remove' },
    });
    expect(removed).toMatchObject({ coverImageId: null, coverUri: null });
    expect(files.removeFile).toHaveBeenCalledWith(second.coverUri);
  } finally {
    db.close();
  }
});

test('does not delete a cover asset that is also referenced by a note or highlight', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const files = fakeCoverFiles();
    const repo = new SqliteBookRepository(db, randomUUID, undefined, files as never);
    const book = await repo.create({ title: '共享封面', status: 'want_to_read', coverSource: { uri: 'file:///stage', extension: 'png' } });
    await db.runAsync('INSERT INTO highlight_images (book_id, image_id, position) VALUES (?, ?, ?)', book.id, book.coverImageId, 0);
    await repo.update(book.id, { title: book.title, author: null, status: book.status, protagonists: [], coverChange: { kind: 'remove' } });
    expect(await db.getFirstAsync('SELECT id FROM image_assets WHERE id = ?', book.coverImageId)).toEqual({ id: book.coverImageId });
    expect(files.removeFile).not.toHaveBeenCalledWith(book.coverUri);
  } finally {
    db.close();
  }
});

test('deletes a book and all of its owned records without deleting global tags or another book', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const tagRepo = new SqliteTagRepository(db, randomUUID);
    const tag = (await tagRepo.list()).find(item => item.name === '古代')!;
    const queue = fakeDeletionQueue();
    const repo = new SqliteBookRepository(db, randomUUID, undefined, undefined, queue as never);
    const book = await repo.create({ title: '要删的书', author: '作者', status: 'finished', protagonists: ['甲', '乙'], tagIds: [tag.id], ratingHalfStars: 8 });
    const other = await repo.create({ title: '保留的书', status: 'want_to_read', tagIds: [tag.id] });
    await db.runAsync('INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES (?, ?, ?, ?)', 'image-delete', book.id, 'file:///app/documents/novel-tracker/delete.jpg', 'now');
    await db.runAsync('UPDATE books SET cover_image_id = ? WHERE id = ?', 'image-delete', book.id);
    await db.runAsync('INSERT INTO notes (id, book_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 'note-delete', book.id, '想法', '2026-09-01', '2026-09-01');
    await db.runAsync('INSERT INTO note_images (note_id, image_id, position) VALUES (?, ?, ?)', 'note-delete', 'image-delete', 0);
    await db.runAsync('INSERT INTO highlight_images (book_id, image_id, position) VALUES (?, ?, ?)', book.id, 'image-delete', 0);

    await repo.delete(book.id);

    expect(await repo.get(book.id)).toBeNull();
    for (const table of ['book_protagonists', 'book_tags', 'reading_sessions', 'notes', 'highlight_images', 'image_assets']) {
      expect(await db.getFirstAsync(`SELECT COUNT(*) AS count FROM ${table} WHERE book_id = ?`, book.id)).toEqual({ count: 0 });
    }
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM note_images WHERE note_id = ?', 'note-delete')).toEqual({ count: 0 });
    expect(await repo.get(other.id)).toMatchObject({ title: '保留的书', tags: [{ id: tag.id }] });
    expect(await db.getFirstAsync('SELECT id FROM tags WHERE id = ?', tag.id)).toEqual({ id: tag.id });
    expect(await db.getFirstAsync('SELECT tag_id FROM book_tags WHERE book_id = ?', other.id)).toEqual({ tag_id: tag.id });
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(queue.enqueue.mock.calls[0][1]).toEqual(['file:///app/documents/novel-tracker/delete.jpg']);
    expect(queue.drain).toHaveBeenCalledTimes(1);
  } finally {
    db.close();
  }
});

test('rejects deletion when an owned image is referenced by another book', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const repo = new SqliteBookRepository(db, randomUUID, undefined, undefined, fakeDeletionQueue() as never);
    const first = await repo.create({ title: '甲书', status: 'want_to_read' });
    const second = await repo.create({ title: '乙书', status: 'want_to_read' });
    await db.runAsync('INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES (?, ?, ?, ?)', 'image-shared', first.id, 'file:///app/documents/novel-tracker/shared.jpg', 'now');
    await db.runAsync('INSERT INTO notes (id, book_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 'note-other', second.id, '其他想法', '2026-09-01', '2026-09-01');
    await db.runAsync('INSERT INTO note_images (note_id, image_id, position) VALUES (?, ?, ?)', 'note-other', 'image-shared', 0);
    await expect(repo.delete(first.id)).rejects.toThrow('图片关联异常');
    expect(await repo.get(first.id)).toMatchObject({ title: '甲书' });
    expect(await db.getFirstAsync('SELECT id FROM image_assets WHERE id = ?', 'image-shared')).toEqual({ id: 'image-shared' });
  } finally {
    db.close();
  }
});

test('rolls back book deletion when the database transaction fails', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    const queue = fakeDeletionQueue();
    const repo = new SqliteBookRepository(db, randomUUID, undefined, undefined, queue as never);
    const book = await repo.create({ title: '不能删除', status: 'want_to_read' });
    await db.execAsync("CREATE TRIGGER fail_book_delete BEFORE DELETE ON books BEGIN SELECT RAISE(ABORT, 'injected delete failure'); END;");
    await expect(repo.delete(book.id)).rejects.toThrow('injected delete failure');
    expect(await repo.get(book.id)).toMatchObject({ title: '不能删除' });
    expect(queue.enqueue).not.toHaveBeenCalled();
  } finally {
    db.close();
  }
});

test('keeps the deletion task when local file cleanup fails after commit', async () => {
  const db = createInMemoryDatabase();
  const files = { removeFile: jest.fn<Promise<void>, [string]>().mockRejectedValue(new Error('busy')) };
  try {
    await migrateDatabase(db);
    const book = await new SqliteBookRepository(db, randomUUID).create({ title: '图片清理', status: 'want_to_read' });
    const path = 'file:///app/documents/novel-tracker/cleanup.jpg';
    await db.runAsync('INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES (?, ?, ?, ?)', 'image-cleanup', book.id, path, 'now');
    await db.runAsync('UPDATE books SET cover_image_id = ? WHERE id = ?', 'image-cleanup', book.id);
    const queue = new ImageDeletionQueue(db, files, ['file:///app/documents/novel-tracker/']);
    const repo = new SqliteBookRepository(db, randomUUID, undefined, undefined, queue);
    await repo.delete(book.id);
    expect(await repo.get(book.id)).toBeNull();
    expect(await db.getFirstAsync('SELECT local_path FROM pending_image_deletions')).toEqual({ local_path: path });
    expect(files.removeFile).toHaveBeenCalledWith(path);
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
