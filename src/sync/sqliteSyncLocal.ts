import Constants from 'expo-constants';
import { SqliteBackupRepository } from '../backup/backupRepository';
import type { BackupManifestV4 } from '../backup/backupTypes';
import { countsFromManifest } from '../backup/backupValidation';
import type { Database } from '../storage/database';
import { LocalSyncStore } from './localSyncStore';
import type { LocalLibrarySnapshot, LocalLibrarySyncPort } from './SyncService';

export class SqliteSyncLocal implements LocalLibrarySyncPort {
  private readonly repository: SqliteBackupRepository;
  private readonly state: LocalSyncStore;

  constructor(db: Database) {
    this.repository = new SqliteBackupRepository(db);
    this.state = new LocalSyncStore(db);
  }

  async readSnapshot(): Promise<LocalLibrarySnapshot> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const revision = await this.state.readLocalRevision();
      const snapshot = await this.repository.createSnapshot(Constants.expoConfig?.version ?? '1.0.0', new Date().toISOString());
      if (revision !== await this.state.readLocalRevision()) continue;
      const manifest: BackupManifestV4 = {
        ...snapshot.data,
        formatVersion: 4,
        exportedAt: snapshot.exportedAt,
        appVersion: snapshot.appVersion,
        images: [],
        counts: countsFromManifest({ ...snapshot.data, images: [] }),
        books: snapshot.data.books.map(book => ({ ...book, coverImageId: book.coverImageId ?? null, whyWantToRead: book.whyWantToRead ?? null, platform: book.platform ?? null })),
      };
      return { revision, manifest, imageSources: snapshot.images, imagePaths: new Map(snapshot.images.map(image => [image.id, image.localPath])) };
    }
    throw new Error('本地书库正在变化，请稍后重试同步');
  }

  readLocalRevision(): Promise<number> { return this.state.readLocalRevision(); }
  readBaseline(): Promise<{ remoteRevision: number; manifestJson: string } | null> { return this.state.readBaseline(); }
  saveBaseline(revision: number, manifest: BackupManifestV4): Promise<void> { return this.state.saveBaseline(revision, JSON.stringify(manifest)); }

  async apply(manifest: BackupManifestV4, paths: ReadonlyMap<string, string>, expectedRevision: number): Promise<void> {
    await this.repository.replaceAll(manifest, paths, expectedRevision);
  }
}
