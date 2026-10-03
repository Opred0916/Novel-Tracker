import { BackupValidationError } from '../../src/backup/backupValidation';
import type { BackupSnapshot } from '../../src/backup/backupRepository';
import { OpenExportService } from '../../src/export/openExportService';
import type { OpenExportProgress } from '../../src/export/openExportTypes';
import { makeEmptyManifest } from '../backup/backupFixtures';

function snapshot(): BackupSnapshot {
  const manifest = makeEmptyManifest();
  const { counts: _counts, images: _images, formatVersion, exportedAt, appVersion, ...data } = manifest;
  return { formatVersion: 3, exportedAt, appVersion, data, images: [] };
}

function setup() {
  const repository = { getOverview: jest.fn().mockResolvedValue(makeEmptyManifest().counts), createSnapshot: jest.fn().mockResolvedValue(snapshot()) };
  const archive = { write: jest.fn().mockResolvedValue(undefined) };
  const storage = {
    createOperation: jest.fn().mockResolvedValue({ id: 'op-1', directoryUri: 'memory://operations/export-op-1', archiveUri: 'memory://operations/export-op-1/NovelTracker.noveltracker' }),
    removeOperation: jest.fn().mockResolvedValue(undefined),
  };
  const service = new OpenExportService(repository as never, archive as never, storage as never, '1.0.0', () => 'op-1', () => new Date(2026, 9, 3, 12, 34, 56));
  return { service, repository, archive, storage };
}

test('creates one timestamped export from one snapshot without touching backup metadata', async () => {
  const { service, repository, archive, storage } = setup();
  const progress: OpenExportProgress[] = [];

  const result = await service.createExport(value => progress.push(value));

  expect(repository.createSnapshot).toHaveBeenCalledTimes(1);
  expect(archive.write).toHaveBeenCalledWith(expect.anything(), 'memory://operations/export-op-1/NovelTracker-export-20261003-123456.zip', expect.any(Function));
  expect(storage.createOperation).toHaveBeenCalledWith('export', 'op-1');
  expect(result).toEqual({ operationId: 'op-1', uri: 'memory://operations/export-op-1/NovelTracker-export-20261003-123456.zip' });
  expect(progress).toEqual([{ stage: 'collecting' }]);
  expect(storage.removeOperation).not.toHaveBeenCalled();
});

test('rejects concurrent export and cleans a failed operation', async () => {
  const { service, archive, storage } = setup();
  let release!: () => void;
  archive.write.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  const first = service.createExport();
  await expect(service.createExport()).rejects.toMatchObject<Partial<BackupValidationError>>({ code: 'busy' });
  release();
  await first;

  archive.write.mockRejectedValueOnce(new Error('write failed'));
  await expect(service.createExport()).rejects.toThrow('write failed');
  expect(storage.removeOperation).toHaveBeenCalledWith('op-1');
});

test('releaseExport removes only the temporary operation after sharing is finished', async () => {
  const { service, storage } = setup();
  await service.createExport();
  await service.releaseExport('op-1');
  expect(storage.removeOperation).toHaveBeenCalledWith('op-1');
});
