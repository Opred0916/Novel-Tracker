import { BackupFileStorage, type BackupStorageBackend } from '../../src/backup/backupFileStorage';
import type { ValidatedBackupArchive } from '../../src/backup/backupArchive';
import { makeValidManifest } from './backupFixtures';

class MemoryBackend implements BackupStorageBackend {
  readonly directories = new Set<string>();
  readonly files = new Map<string, string | Uint8Array>();
  failCopy = false;
  failRemoveFile = false;

  async ensureDirectory(uri: string) { this.directories.add(uri); }
  async removeTree(uri: string) {
    for (const path of [...this.directories]) if (path === uri || path.startsWith(`${uri}/`)) this.directories.delete(path);
    for (const path of [...this.files.keys()]) if (path === uri || path.startsWith(`${uri}/`)) this.files.delete(path);
  }
  async listDirectories(uri: string) { return [...this.directories].filter(path => path.startsWith(`${uri}/`) && !path.slice(uri.length + 1).includes('/')); }
  async copyFile(source: string, destination: string) {
    if (this.failCopy) throw new Error('copy failed');
    const data = this.files.get(source);
    if (!(data instanceof Uint8Array)) throw new Error('missing source');
    this.files.set(destination, data.slice());
  }
  async readText(uri: string) { const value = this.files.get(uri); return typeof value === 'string' ? value : null; }
  async writeText(uri: string, value: string) { this.files.set(uri, value); }
  async removeFile(uri: string) { if (this.failRemoveFile) throw new Error('remove failed'); this.files.delete(uri); }
}

const archiveFixture = (): ValidatedBackupArchive => ({
  manifest: makeValidManifest(),
  imagePaths: new Map([['image-1', 'cache://operations/import/images/image-1.jpg']]),
});

describe('BackupFileStorage', () => {
  test('creates isolated operation and generation directories and copies each image once', async () => {
    const backend = new MemoryBackend();
    backend.files.set('cache://operations/import/images/image-1.jpg', new Uint8Array([1, 2, 3]));
    const storage = new BackupFileStorage(backend, { operations: 'cache://operations', generations: 'doc://generations', preferences: 'doc://preferences' });

    const operation = await storage.createOperation('export', 'op-1');
    const generation = await storage.createRestoreGeneration('gen-1');
    const paths = await storage.copyValidatedImages(archiveFixture(), generation);

    expect(operation).toEqual({ id: 'op-1', directoryUri: 'cache://operations/export-op-1', archiveUri: 'cache://operations/export-op-1/NovelTracker.noveltracker' });
    expect(paths.get('image-1')).toBe('doc://generations/gen-1/images/image-1.jpg');
    expect(backend.files.get(paths.get('image-1')!)).toEqual(new Uint8Array([1, 2, 3]));
  });

  test('removes a failed generation and keeps only the active generation during cleanup', async () => {
    const backend = new MemoryBackend();
    const storage = new BackupFileStorage(backend, { operations: 'cache://operations', generations: 'doc://generations', preferences: 'doc://preferences' });
    const active = await storage.createRestoreGeneration('active');
    const failed = await storage.createRestoreGeneration('failed');

    await storage.removeGeneration(failed.id);
    await storage.createRestoreGeneration('obsolete');
    await storage.cleanupObsolete([active.directoryUri]);

    expect(backend.directories.has(active.directoryUri)).toBe(true);
    expect(backend.directories.has(failed.directoryUri)).toBe(false);
    expect(backend.directories.has('doc://generations/obsolete')).toBe(false);
  });

  test('cleans stale operations and treats a damaged last-generated record as absent', async () => {
    const backend = new MemoryBackend();
    const storage = new BackupFileStorage(backend, { operations: 'cache://operations', generations: 'doc://generations', preferences: 'doc://preferences' });
    await storage.createOperation('restore', 'stale');
    backend.files.set('doc://preferences/last-generated.txt', 'not-a-date');

    expect(await storage.getLastGeneratedAt()).toBeNull();
    await storage.setLastGeneratedAt('2026-10-02T12:00:00.000Z');
    expect(await storage.getLastGeneratedAt()).toBe('2026-10-02T12:00:00.000Z');
    await storage.cleanupStaleOperations();
    expect(backend.directories.has('cache://operations/restore-stale')).toBe(false);
  });

  test('persists failed old-file cleanup and retries it on the next startup cleanup', async () => {
    const backend = new MemoryBackend();
    backend.files.set('old.jpg', new Uint8Array([1]));
    const storage = new BackupFileStorage(backend, { operations: 'cache://operations', generations: 'doc://generations', preferences: 'doc://preferences' });
    await storage.deferFileCleanup(['old.jpg']);
    expect(backend.files.get('doc://preferences/pending-cleanup.json')).toBe('["old.jpg"]');

    await storage.cleanupStaleOperations();

    expect(backend.files.has('old.jpg')).toBe(false);
    expect(backend.files.has('doc://preferences/pending-cleanup.json')).toBe(false);
  });
});
