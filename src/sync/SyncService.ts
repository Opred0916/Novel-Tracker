import type { BackupManifestV4, BackupImageEntry } from '../backup/backupTypes';
import type { BackupImageSource } from '../backup/backupRepository';
import { validateBackupManifest } from '../backup/backupValidation';
import type { CloudSnapshotStore } from './cloudSnapshot';
import { CloudConflictError } from './cloudSnapshot';
import { mergeManifests, sameManifestContent, type ConflictChoices, type SyncConflict } from './merge';

export type LocalLibrarySnapshot = {
  revision: number;
  manifest: BackupManifestV4;
  imageSources: BackupImageSource[];
  imagePaths: Map<string, string>;
};

export interface LocalLibrarySyncPort {
  readSnapshot(): Promise<LocalLibrarySnapshot>;
  readLocalRevision(): Promise<number>;
  readBaseline(): Promise<{ remoteRevision: number; manifestJson: string } | null>;
  saveBaseline(revision: number, manifest: BackupManifestV4): Promise<void>;
  apply(manifest: BackupManifestV4, paths: ReadonlyMap<string, string>, expectedRevision: number): Promise<void>;
}

export interface SyncImagePort {
  uploadMissingImages(userId: string, sources: BackupImageSource[], remoteImages: BackupImageEntry[]): Promise<BackupImageEntry[]>;
  downloadMissingImages(userId: string, entries: BackupImageEntry[], knownPaths: ReadonlyMap<string, string>): Promise<Map<string, string>>;
}

export type SyncResult = { status: 'synced' | 'retry' | 'conflict'; conflicts?: SyncConflict[]; revision?: number };

function emptyManifest(): BackupManifestV4 {
  return {
    formatVersion: 4, exportedAt: new Date().toISOString(), appVersion: '1.0.0',
    counts: { books: 0, protagonists: 0, tags: 0, bookTags: 0, quickTags: 0, readingSessions: 0, notes: 0, noteImages: 0, highlightImages: 0, images: 0 },
    books: [], protagonists: [], tags: [], bookTags: [], quickTags: [], readingSessions: [], notes: [], noteImages: [], highlightImages: [], images: [],
  };
}

export class SyncService {
  private pending: { base: BackupManifestV4; local: BackupManifestV4; remote: BackupManifestV4; localRevision: number; remoteRevision: number; imagePaths: Map<string, string> } | null = null;
  private active = true;
  constructor(
    private readonly userId: string,
    private readonly local: LocalLibrarySyncPort,
    private readonly cloud: CloudSnapshotStore,
    private readonly images: SyncImagePort,
  ) {}

  pause(): void { this.active = false; }

  async sync(): Promise<SyncResult> {
    this.pending = null;
    const baseline = await this.local.readBaseline();
    const base = baseline ? validateBackupManifest(JSON.parse(baseline.manifestJson)) as unknown as BackupManifestV4 : emptyManifest();
    if (base.formatVersion !== 4) throw new Error('本地同步记录格式尚不支持');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = await this.local.readSnapshot();
      const remote = await this.cloud.read();
      if (baseline && !remote) throw new Error('云端书库意外缺失，已停止同步以保护本机记录');
      const localManifest: BackupManifestV4 = {
        ...snapshot.manifest,
        images: await this.images.uploadMissingImages(this.userId, snapshot.imageSources, remote?.manifest.images ?? []),
      };
      localManifest.counts = { ...localManifest.counts, images: localManifest.images.length };
      validateBackupManifest(localManifest);
      if (await this.local.readLocalRevision() !== snapshot.revision) return { status: 'retry' };
      const merged = mergeManifests(base, localManifest, remote?.manifest ?? emptyManifest());
      if (!merged.manifest) {
        this.pending = { base, local: localManifest, remote: remote?.manifest ?? emptyManifest(), localRevision: snapshot.revision, remoteRevision: remote?.revision ?? 0, imagePaths: snapshot.imagePaths };
        return { status: 'conflict', conflicts: merged.conflicts };
      }
      if (!this.active) return { status: 'retry' };

      let revision = remote?.revision ?? 0;
      if (!remote || !sameManifestContent(merged.manifest, remote.manifest)) {
        try { revision = await this.cloud.commit(revision, merged.manifest); }
        catch (error) { if (error instanceof CloudConflictError) continue; throw error; }
      }
      if (await this.local.readLocalRevision() !== snapshot.revision) return { status: 'retry' };
      if (!this.active) return { status: 'retry' };
      if (!sameManifestContent(localManifest, merged.manifest)) {
        const paths = await this.images.downloadMissingImages(this.userId, merged.manifest.images, snapshot.imagePaths);
        try { await this.local.apply(merged.manifest, paths, snapshot.revision); }
        catch (error) {
          if (error instanceof Error && error.message.includes('本地书库已变化')) return { status: 'retry' };
          throw error;
        }
      }
      await this.local.saveBaseline(revision, merged.manifest);
      return { status: 'synced', revision };
    }
    return { status: 'retry' };
  }

  async resolve(choices: ConflictChoices): Promise<SyncResult> {
    const pending = this.pending;
    if (!pending) throw new Error('没有待处理的冲突');
    if (await this.local.readLocalRevision() !== pending.localRevision) return this.sync();
    const freshRemote = await this.cloud.read();
    if ((freshRemote?.revision ?? 0) !== pending.remoteRevision) return this.sync();
    const merged = mergeManifests(pending.base, pending.local, pending.remote, choices);
    if (!merged.manifest) return { status: 'conflict', conflicts: merged.conflicts };
    if (!this.active) return { status: 'retry' };
    let revision = pending.remoteRevision;
    if (!freshRemote || !sameManifestContent(merged.manifest, freshRemote.manifest)) {
      try { revision = await this.cloud.commit(revision, merged.manifest); }
      catch (error) { if (error instanceof CloudConflictError) return this.sync(); throw error; }
    }
    if (await this.local.readLocalRevision() !== pending.localRevision || !this.active) return { status: 'retry' };
    if (!sameManifestContent(pending.local, merged.manifest)) {
      const paths = await this.images.downloadMissingImages(this.userId, merged.manifest.images, pending.imagePaths);
      try { await this.local.apply(merged.manifest, paths, pending.localRevision); }
      catch (error) {
        if (error instanceof Error && error.message.includes('本地书库已变化')) return { status: 'retry' };
        throw error;
      }
    }
    await this.local.saveBaseline(revision, merged.manifest);
    this.pending = null;
    return { status: 'synced', revision };
  }
}
