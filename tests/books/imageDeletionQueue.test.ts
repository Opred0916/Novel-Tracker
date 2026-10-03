import { migrateDatabase } from '../../src/storage/database';
import { ImageDeletionQueue } from '../../src/books/imageDeletionQueue';
import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';

const ROOT = 'file:///app/documents/novel-tracker/';
const imagePath = (name: string) => `${ROOT}${name}`;

function createFiles() {
  return { removeFile: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined) };
}

async function enqueue(db: ReturnType<typeof createInMemoryDatabase>, queue: ImageDeletionQueue, paths: string[]) {
  await db.withExclusiveTransactionAsync(async txn => queue.enqueue(txn, paths));
}

test('migration creates a durable image deletion queue at version 9', async () => {
  const db = createInMemoryDatabase();
  try {
    await migrateDatabase(db);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 10 });
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pending_image_deletions'")).toEqual({
      name: 'pending_image_deletions',
    });
    await migrateDatabase(db);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM pending_image_deletions')).toEqual({ count: 0 });
  } finally {
    db.close();
  }
});

test('drain removes unreferenced files once and deduplicates queued paths', async () => {
  const db = createInMemoryDatabase();
  const files = createFiles();
  try {
    await migrateDatabase(db);
    const queue = new ImageDeletionQueue(db, files, [ROOT]);
    const path = imagePath('book-1/image.jpg');
    await enqueue(db, queue, [path, path]);

    await queue.drain();

    expect(files.removeFile).toHaveBeenCalledTimes(1);
    expect(files.removeFile).toHaveBeenCalledWith(path);
    expect(await db.getAllAsync('SELECT * FROM pending_image_deletions')).toEqual([]);
  } finally {
    db.close();
  }
});

test('drain retains referenced or unsafe paths and retries failed deletion', async () => {
  const db = createInMemoryDatabase();
  const files = createFiles();
  try {
    await migrateDatabase(db);
    await db.runAsync("INSERT INTO books (id, title, status, created_at, updated_at) VALUES ('book-1', '长夜', 'reading', 'a', 'b')");
    const referenced = imagePath('book-1/referenced.jpg');
    await db.runAsync("INSERT INTO image_assets (id, book_id, local_path, created_at) VALUES ('image-1', 'book-1', ?, 'a')", referenced);
    const unsafe = 'file:///app/documents/novel-tracker/../outside.jpg';
    const failed = imagePath('book-1/retry.jpg');
    files.removeFile.mockRejectedValueOnce(new Error('busy'));
    const queue = new ImageDeletionQueue(db, files, [ROOT]);
    await enqueue(db, queue, [referenced, unsafe, failed]);

    await queue.drain();

    expect(files.removeFile).toHaveBeenCalledTimes(1);
    expect(files.removeFile).toHaveBeenCalledWith(failed);
    expect(await db.getAllAsync<{ local_path: string }>('SELECT local_path FROM pending_image_deletions ORDER BY local_path')).toEqual([
      { local_path: unsafe }, { local_path: referenced }, { local_path: failed },
    ]);

    files.removeFile.mockResolvedValue(undefined);
    await queue.drain();
    expect(files.removeFile).toHaveBeenCalledTimes(2);
    expect(await db.getAllAsync<{ local_path: string }>('SELECT local_path FROM pending_image_deletions ORDER BY local_path')).toEqual([
      { local_path: unsafe }, { local_path: referenced },
    ]);

    await db.runAsync('DELETE FROM image_assets WHERE id = ?', 'image-1');
    await queue.drain();
    expect(files.removeFile).toHaveBeenCalledWith(referenced);
    expect(await db.getAllAsync('SELECT * FROM pending_image_deletions')).toEqual([{ local_path: unsafe }]);
  } finally {
    db.close();
  }
});

test('drain does not delete a path outside managed roots or with encoded traversal', async () => {
  const db = createInMemoryDatabase();
  const files = createFiles();
  try {
    await migrateDatabase(db);
    const queue = new ImageDeletionQueue(db, files, [ROOT]);
    const outside = 'file:///app/documents/novel-tracker-backup/image.jpg';
    const encodedTraversal = 'file:///app/documents/novel-tracker/%2e%2e/outside.jpg';
    const encodedSeparators = 'file:///app/documents/novel-tracker/%2e%2e%2f%2e%2e%2fvictim.jpg';
    await enqueue(db, queue, [outside, encodedTraversal, encodedSeparators]);

    await queue.drain();

    expect(files.removeFile).not.toHaveBeenCalled();
    expect(await db.getAllAsync<{ local_path: string }>('SELECT local_path FROM pending_image_deletions ORDER BY local_path')).toEqual([
      { local_path: outside }, { local_path: encodedSeparators }, { local_path: encodedTraversal },
    ]);
  } finally {
    db.close();
  }
});
