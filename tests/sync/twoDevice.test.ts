import type { BackupManifestV4 } from '../../src/backup/backupTypes';
import { countsFromManifest } from '../../src/backup/backupValidation';
import { CloudConflictError } from '../../src/sync/cloudSnapshot';
import { SyncService, type LocalLibrarySyncPort } from '../../src/sync/SyncService';

const date = '2026-10-10T00:00:00.000Z';
const userId = '8c53bb6d-51e7-4795-b4dc-327c836b7f90';

function library(ids: string[] = []): BackupManifestV4 {
  const value: BackupManifestV4 = {
    formatVersion: 4, exportedAt: date, appVersion: '1.0.0',
    books: ids.map(id => ({ id, title: id, author: null, status: 'want_to_read', bookType: null, ratingHalfStars: null, legacyReadCount: 0, createdAt: date, updatedAt: date, coverImageId: null, whyWantToRead: null, platform: null })),
    protagonists: [], tags: [], bookTags: [], quickTags: [], readingSessions: [], notes: [], noteImages: [], highlightImages: [], images: [],
    counts: { books: 0, protagonists: 0, tags: 0, bookTags: 0, quickTags: 0, readingSessions: 0, notes: 0, noteImages: 0, highlightImages: 0, images: 0 },
  };
  value.counts = countsFromManifest(value);
  return value;
}

function device() {
  let revision = 0;
  let manifest = library();
  let baseline: { remoteRevision: number; manifestJson: string } | null = null;
  const port: LocalLibrarySyncPort = {
    readSnapshot: async () => ({ revision, manifest, imageSources: [], imagePaths: new Map() }),
    readLocalRevision: async () => revision,
    readBaseline: async () => baseline,
    saveBaseline: async (remoteRevision, merged) => { baseline = { remoteRevision, manifestJson: JSON.stringify(merged) }; },
    apply: async (merged, _paths, expectedRevision) => {
      if (revision !== expectedRevision) throw new Error('本地书库已变化');
      manifest = merged;
      revision += 1;
    },
  };
  return {
    port,
    addBook: (id: string) => { manifest = library([...manifest.books.map(book => book.id), id]); revision += 1; },
    titles: () => manifest.books.map(book => book.title),
  };
}

test('two devices merge distinct offline additions and converge without erasing either book', async () => {
  let remoteRevision = 0;
  let remote: BackupManifestV4 | null = null;
  const cloud = {
    read: async () => remote ? { revision: remoteRevision, manifest: remote } : null,
    commit: async (expected: number, next: BackupManifestV4) => {
      if (expected !== remoteRevision) throw new CloudConflictError();
      remote = next;
      return ++remoteRevision;
    },
  };
  const images = { uploadMissingImages: async () => [], downloadMissingImages: async () => new Map() };
  const first = device();
  const second = device();
  const firstSync = new SyncService(userId, first.port, cloud, images);
  const secondSync = new SyncService(userId, second.port, cloud, images);

  first.addBook('first');
  expect((await firstSync.sync()).status).toBe('synced');
  expect((await secondSync.sync()).status).toBe('synced');
  first.addBook('offline-a');
  second.addBook('offline-b');
  expect((await firstSync.sync()).status).toBe('synced');
  expect((await secondSync.sync()).status).toBe('synced');
  expect((await firstSync.sync()).status).toBe('synced');
  expect(first.titles()).toEqual(['first', 'offline-a', 'offline-b']);
  expect(second.titles()).toEqual(first.titles());
  expect((await cloud.read())?.manifest.books.map(book => book.id)).toEqual(first.titles());
});
