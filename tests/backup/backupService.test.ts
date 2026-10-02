import { BackupService } from '../../src/backup/backupService';
import type { BackupArchive, ValidatedBackupArchive } from '../../src/backup/backupArchive';
import type { SqliteBackupRepository, BackupSnapshot } from '../../src/backup/backupRepository';
import type { BackupFileStorage, BackupOperation, RestoreGeneration } from '../../src/backup/backupFileStorage';
import { makeValidManifest } from './backupFixtures';

function snapshot(): BackupSnapshot {
  const manifest = makeValidManifest();
  const { images: _images, counts: _counts, formatVersion, exportedAt, appVersion, ...data } = manifest;
  return { formatVersion, exportedAt, appVersion, data, images: [{ id: 'image-1', bookId: 'book-1', createdAt: manifest.images[0].createdAt, extension: 'jpg', localPath: 'old.jpg', archivePath: 'images/image-1.jpg' }] };
}

class FakeRepository {
  replaced = false;
  replacedManifest: ReturnType<typeof makeValidManifest> | null = null;
  failReplace = false;
  async getOverview() { return makeValidManifest().counts; }
  async createSnapshot() { return snapshot(); }
  async replaceAll(manifest: ReturnType<typeof makeValidManifest>) { if (this.failReplace) throw new Error('db failed'); this.replaced = true; this.replacedManifest = manifest; return ['old.jpg']; }
}

class FakeArchive {
  failWrite = false;
  async write(_snapshot: BackupSnapshot, _uri: string, onProgress?: (value: any) => void) { if (this.failWrite) throw new Error('zip failed'); onProgress?.({ stage: 'packing', processedBytes: 1 }); }
  async inspect(): Promise<ValidatedBackupArchive> { return { manifest: makeValidManifest(), imagePaths: new Map([['image-1', 'staged.jpg']]) }; }
}

class FakeStorage {
  removedOperations: string[] = [];
  removedGenerations: string[] = [];
  copied = false;
  failCopy = false;
  lastGenerated: string | null = null;
  failRemoveFiles = false;
  deferredFiles: string[] = [];
  async createOperation(kind: 'export' | 'restore', id: string): Promise<BackupOperation> { return { id, directoryUri: `ops/${kind}-${id}`, archiveUri: `ops/${kind}-${id}/backup.noveltracker` }; }
  async createRestoreGeneration(id: string): Promise<RestoreGeneration> { return { id, directoryUri: `gens/${id}` }; }
  async copyValidatedImages() { if (this.failCopy) throw new Error('copy failed'); this.copied = true; return new Map([['image-1', 'gens/new/image-1.jpg']]); }
  async removeOperation(id: string) { this.removedOperations.push(id); }
  async removeGeneration(id: string) { this.removedGenerations.push(id); }
  async cleanupObsolete() {}
  async cleanupStaleOperations() {}
  async removeFiles() { if (this.failRemoveFiles) throw new Error('remove failed'); }
  async deferFileCleanup(paths: readonly string[]) { this.deferredFiles.push(...paths); }
  async getLastGeneratedAt() { return this.lastGenerated; }
  async setLastGeneratedAt(value: string) { this.lastGenerated = value; }
}

function makeService(parts?: { repository?: FakeRepository; archive?: FakeArchive; storage?: FakeStorage }) {
  const repository = parts?.repository ?? new FakeRepository();
  const archive = parts?.archive ?? new FakeArchive();
  const storage = parts?.storage ?? new FakeStorage();
  let next = 0;
  return {
    repository, archive, storage,
    service: new BackupService(
      repository as unknown as SqliteBackupRepository,
      archive as unknown as BackupArchive,
      storage as unknown as BackupFileStorage,
      '1.0.0',
      () => `id-${++next}`,
      () => '2026-10-02T12:00:00.000Z',
    ),
  };
}

describe('BackupService', () => {
  test('creates one backup file, records generation time, and exposes cleanup token', async () => {
    const { service, storage } = makeService();
    const stages: string[] = [];
    const generated = await service.createBackup(progress => stages.push(progress.stage));
    expect(generated).toEqual({ operationId: 'id-1', uri: 'ops/export-id-1/backup.noveltracker' });
    expect(storage.lastGenerated).toBe('2026-10-02T12:00:00.000Z');
    expect(stages).toEqual(['collecting', 'packing']);
    await service.releaseGeneratedBackup(generated.operationId);
    expect(storage.removedOperations).toContain('id-1');
  });

  test('inspection is read-only until the opaque token is restored', async () => {
    const { service, repository } = makeService();
    const inspection = await service.inspectBackup('picked.noveltracker');
    expect(repository.replaced).toBe(false);
    expect(inspection.counts.books).toBe(1);
    await service.restore(inspection.token);
    expect(repository.replaced).toBe(true);
  });

  test('mutating the preview object cannot change the validated data used for restore', async () => {
    const { service, repository } = makeService();
    const inspection = await service.inspectBackup('picked.noveltracker');
    inspection.manifest.books[0].title = '被篡改';
    inspection.counts.books = 999;

    await service.restore(inspection.token);

    expect(repository.replacedManifest?.books[0].title).toBe('长夜');
  });

  test('cancelling inspection removes staging without replacing data', async () => {
    const { service, repository, storage } = makeService();
    const inspection = await service.inspectBackup('picked.noveltracker');
    await service.cancelInspection(inspection.token);
    expect(repository.replaced).toBe(false);
    expect(storage.removedOperations).toContain(inspection.stagingOperationId);
  });

  test.each([
    ['archive generation', (parts: ReturnType<typeof makeService>) => { parts.archive.failWrite = true; }],
    ['image staging', (parts: ReturnType<typeof makeService>) => { parts.storage.failCopy = true; }],
    ['database replacement', (parts: ReturnType<typeof makeService>) => { parts.repository.failReplace = true; }],
  ])('cleans new resources and preserves the old library when %s fails', async (_name, arrange) => {
    const parts = makeService();
    arrange(parts);
    if (parts.archive.failWrite) {
      await expect(parts.service.createBackup()).rejects.toThrow();
      expect(parts.storage.removedOperations).toContain('id-1');
    } else {
      const inspection = await parts.service.inspectBackup('picked.noveltracker');
      await expect(parts.service.restore(inspection.token)).rejects.toThrow();
      expect(parts.storage.removedGenerations).toContain('id-3');
      expect(parts.repository.replaced).toBe(false);
    }
  });

  test('does not report restore failure when obsolete-file cleanup fails after commit', async () => {
    const parts = makeService();
    parts.storage.cleanupObsolete = async () => { throw new Error('cleanup failed'); };
    const inspection = await parts.service.inspectBackup('picked.noveltracker');
    await expect(parts.service.restore(inspection.token)).resolves.toBeUndefined();
    expect(parts.repository.replaced).toBe(true);
  });

  test('queues old image paths when post-commit deletion fails', async () => {
    const parts = makeService();
    parts.storage.failRemoveFiles = true;
    const inspection = await parts.service.inspectBackup('picked.noveltracker');
    await parts.service.restore(inspection.token);
    expect(parts.storage.deferredFiles).toEqual(['old.jpg']);
  });
});
