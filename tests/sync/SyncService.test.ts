import type { BackupManifestV4 } from '../../src/backup/backupTypes';
import { countsFromManifest } from '../../src/backup/backupValidation';
import { CloudConflictError } from '../../src/sync/cloudSnapshot';
import { SyncService } from '../../src/sync/SyncService';

const now = '2026-10-10T00:00:00.000Z';
function empty(): BackupManifestV4 {
  return { formatVersion: 4, exportedAt: now, appVersion: '1.0.0', counts: { books: 0, protagonists: 0, tags: 0, bookTags: 0, quickTags: 0, readingSessions: 0, notes: 0, noteImages: 0, highlightImages: 0, images: 0 }, books: [], protagonists: [], tags: [], bookTags: [], quickTags: [], readingSessions: [], notes: [], noteImages: [], highlightImages: [], images: [] };
}
function withBook(id: string): BackupManifestV4 {
  const draft = empty();
  draft.books = [{ id, title: id, author: null, status: 'want_to_read', bookType: null, ratingHalfStars: null, legacyReadCount: 0, createdAt: now, updatedAt: now, coverImageId: null, whyWantToRead: null, platform: null }];
  draft.counts = countsFromManifest(draft);
  return draft;
}

function fixtures(localManifest = empty(), remoteManifest: BackupManifestV4 | null = null) {
  let revision = 1;
  let remoteRevision = remoteManifest ? 1 : 0;
  let currentRemote = remoteManifest;
  const local = {
    readSnapshot: jest.fn(async () => ({ revision, manifest: localManifest, imageSources: [], imagePaths: new Map() })),
    readLocalRevision: jest.fn(async () => revision),
    readBaseline: jest.fn(async (): Promise<{ remoteRevision: number; manifestJson: string } | null> => null),
    saveBaseline: jest.fn(async () => undefined),
    apply: jest.fn(async () => undefined),
  };
  const cloud = {
    read: jest.fn(async () => currentRemote ? { revision: remoteRevision, manifest: currentRemote } : null),
    commit: jest.fn(async (expected: number, manifest: BackupManifestV4) => {
      if (expected !== remoteRevision) throw new CloudConflictError();
      remoteRevision += 1;
      currentRemote = manifest;
      return remoteRevision;
    }),
  };
  const images = {
    uploadMissingImages: jest.fn(async () => []),
    downloadMissingImages: jest.fn(async () => new Map()),
  };
  return { local, cloud, images, setLocalRevision: (next: number) => { revision = next; }, remote: () => currentRemote };
}

test('first device uploads before saving baseline', async () => {
  const f = fixtures(withBook('a'));
  const result = await new SyncService('8c53bb6d-51e7-4795-b4dc-327c836b7f90', f.local, f.cloud, f.images).sync();
  expect(result.status).toBe('synced');
  expect(f.remote()?.books.map(book => book.id)).toEqual(['a']);
  expect(f.local.saveBaseline).toHaveBeenCalledWith(1, expect.objectContaining({ books: expect.any(Array) }));
  expect(f.images.uploadMissingImages.mock.invocationCallOrder[0]).toBeLessThan(f.cloud.commit.mock.invocationCallOrder[0]);
});

test('second device downloads cloud records into its empty account library', async () => {
  const f = fixtures(empty(), withBook('a'));
  const result = await new SyncService('8c53bb6d-51e7-4795-b4dc-327c836b7f90', f.local, f.cloud, f.images).sync();
  expect(result.status).toBe('synced');
  expect(f.cloud.commit).not.toHaveBeenCalled();
  expect(f.local.apply).toHaveBeenCalledWith(expect.objectContaining({ books: [expect.objectContaining({ id: 'a' })] }), expect.any(Map), 1);
});

test('cloud version race is retried without replacing local data', async () => {
  const f = fixtures(withBook('a'));
  f.cloud.commit.mockRejectedValueOnce(new CloudConflictError());
  const result = await new SyncService('8c53bb6d-51e7-4795-b4dc-327c836b7f90', f.local, f.cloud, f.images).sync();
  expect(result.status).toBe('synced');
  expect(f.cloud.commit).toHaveBeenCalledTimes(2);
});

test('a local edit during transfer defers publishing stale data', async () => {
  const f = fixtures(withBook('a'));
  f.images.uploadMissingImages.mockImplementationOnce(async () => { f.setLocalRevision(2); return []; });
  const result = await new SyncService('8c53bb6d-51e7-4795-b4dc-327c836b7f90', f.local, f.cloud, f.images).sync();
  expect(result.status).toBe('retry');
  expect(f.cloud.commit).not.toHaveBeenCalled();
  expect(f.local.apply).not.toHaveBeenCalled();
});

test('pausing during transfer prevents a cloud commit', async () => {
  const f = fixtures(withBook('a'));
  const service = new SyncService('8c53bb6d-51e7-4795-b4dc-327c836b7f90', f.local, f.cloud, f.images);
  f.images.uploadMissingImages.mockImplementationOnce(async () => { service.pause(); return []; });
  expect((await service.sync()).status).toBe('retry');
  expect(f.cloud.commit).not.toHaveBeenCalled();
});

test('a conflicting note is not published until the reader chooses a side', async () => {
  const base = withBook('a');
  const original = { id: 'n', bookId: 'a', body: 'original', createdAt: now, updatedAt: now, readingSessionId: null, sourceKind: 'app' as const, originalRecordedOn: null, originalRecordedTime: null };
  base.notes = [original]; base.counts = countsFromManifest(base);
  const localManifest = { ...base, notes: [{ ...original, body: 'mine' }] };
  const remoteManifest = { ...base, notes: [{ ...original, body: 'theirs' }] };
  const f = fixtures(localManifest, remoteManifest);
  f.local.readBaseline.mockResolvedValue({ remoteRevision: 1, manifestJson: JSON.stringify(base) });
  const service = new SyncService('8c53bb6d-51e7-4795-b4dc-327c836b7f90', f.local, f.cloud, f.images);
  const first = await service.sync();
  expect(first.status).toBe('conflict');
  expect(f.cloud.commit).not.toHaveBeenCalled();
  const chosen = await service.resolve({ 'notes:n': 'local' });
  expect(chosen.status).toBe('synced');
  expect(f.remote()?.notes[0].body).toBe('mine');
});
