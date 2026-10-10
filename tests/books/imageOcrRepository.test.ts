import { migrateDatabase } from '../../src/storage/database';
import { SqliteImageOcrRepository } from '../../src/books/imageOcrRepository';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

async function setup() {
  const db = createInMemoryDatabase();
  await migrateDatabase(db);
  await db.execAsync(`
    INSERT INTO books (id, title, status, created_at, updated_at) VALUES ('book-1', '长夜', 'finished', '2026-01-01', '2026-01-01');
    INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES
      ('image-shared', 'book-1', 'file:///managed/shared.jpg', '2026-01-01T00:00:00Z'),
      ('image-cover', 'book-1', 'file:///managed/cover.jpg', '2026-01-01T00:00:00Z'),
      ('image-orphan', 'book-1', 'file:///managed/orphan.jpg', '2026-01-01T00:00:00Z');
    INSERT INTO notes (id, book_id, body, created_at, updated_at) VALUES ('note-1', 'book-1', '摘记', '2026-01-01', '2026-01-01');
    INSERT INTO highlight_images (book_id, image_id, position) VALUES ('book-1', 'image-shared', 0);
    INSERT INTO note_images (note_id, image_id, position) VALUES ('note-1', 'image-shared', 0);
    UPDATE books SET cover_image_id = 'image-cover' WHERE id = 'book-1';
  `);
  return { db, repository: new SqliteImageOcrRepository(db) };
}

test('migrates v10 without changing existing image relationships', async () => {
  const { db, repository } = await setup();
  try {
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(13);
    expect(await db.getFirstAsync<{ image_id: string }>('SELECT image_id FROM highlight_images WHERE book_id = ?', 'book-1')).toEqual({ image_id: 'image-shared' });
    await repository.reconcile(true);
    expect(await db.getAllAsync<{ image_id: string; status: string }>('SELECT image_id, status FROM image_ocr ORDER BY image_id')).toEqual([
      { image_id: 'image-shared', status: 'pending' },
    ]);
  } finally { db.close(); }
});

test('reconcile deduplicates references and recovers interrupted work only on startup', async () => {
  const { db, repository } = await setup();
  try {
    await repository.reconcile(true);
    expect(await repository.markProcessing('image-shared')).toBe(true);
    await repository.reconcile(false);
    expect(await db.getFirstAsync<{ status: string }>('SELECT status FROM image_ocr WHERE image_id = ?', 'image-shared')).toEqual({ status: 'processing' });
    await repository.reconcile(true);
    expect(await db.getFirstAsync<{ status: string }>('SELECT status FROM image_ocr WHERE image_id = ?', 'image-shared')).toEqual({ status: 'pending' });
    expect(await repository.markProcessing('image-shared')).toBe(true);
    await repository.finish('image-shared', ' 长夜\n顾昀 ', 'vision-1');
    await repository.reconcile(true);
    expect(await db.getFirstAsync<{ status: string; recognized_text: string }>('SELECT status, recognized_text FROM image_ocr WHERE image_id = ?', 'image-shared')).toEqual({ status: 'recognized', recognized_text: '长夜\n顾昀' });
  } finally { db.close(); }
});

test('does not enqueue orphaned or cover-only images and tracks retryable failure', async () => {
  const { db, repository } = await setup();
  try {
    await repository.reconcile(true);
    expect(await repository.nextPending()).toEqual({ imageId: 'image-shared', bookId: 'book-1', localPath: 'file:///managed/shared.jpg' });
    await repository.markProcessing('image-shared');
    await repository.fail('image-shared', 'file_unreadable');
    expect(await repository.progress()).toEqual({ done: 1, total: 1, failed: 1 });
    await repository.retry('image-shared');
    expect(await repository.nextPending()).toEqual({ imageId: 'image-shared', bookId: 'book-1', localPath: 'file:///managed/shared.jpg' });
    expect(await repository.retry('image-orphan')).toBe(false);
  } finally { db.close(); }
});

test('counts recognized, empty and failed as done progress', async () => {
  const { db, repository } = await setup();
  try {
    await repository.reconcile(true);
    await repository.markProcessing('image-shared');
    await repository.finish('image-shared', '   ', 'vision-1');
    expect(await repository.progress('book-1')).toEqual({ done: 1, total: 1, failed: 0 });
  } finally { db.close(); }
});

test('reads one image OCR record for preview status', async () => {
  const { db, repository } = await setup();
  try {
    await repository.reconcile();
    await repository.markProcessing('image-shared');
    await repository.finish('image-shared', '识别结果', 'test');
    expect(await repository.get('image-shared')).toEqual({ imageId: 'image-shared', status: 'recognized', recognizedText: '识别结果', errorCode: null });
  } finally { db.close(); }
});
