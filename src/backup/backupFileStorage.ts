import { Directory, File, Paths } from 'expo-file-system';
import type { ValidatedBackupArchive } from './backupArchive';

export type BackupStorageRoots = { operations: string; generations: string; preferences: string };
export type BackupOperation = { id: string; directoryUri: string; archiveUri: string };
export type RestoreGeneration = { id: string; directoryUri: string };

export interface BackupStorageBackend {
  ensureDirectory(uri: string): Promise<void>;
  removeTree(uri: string): Promise<void>;
  listDirectories(uri: string): Promise<string[]>;
  copyFile(source: string, destination: string): Promise<void>;
  readText(uri: string): Promise<string | null>;
  writeText(uri: string, value: string): Promise<void>;
  removeFile(uri: string): Promise<void>;
}

const join = (base: string, name: string): string => `${base.replace(/\/$/, '')}/${name}`;

export class ExpoBackupStorageBackend implements BackupStorageBackend {
  async ensureDirectory(uri: string): Promise<void> {
    const directory = new Directory(uri);
    if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
  }

  async removeTree(uri: string): Promise<void> {
    const directory = new Directory(uri);
    if (directory.exists) directory.delete();
  }

  async listDirectories(uri: string): Promise<string[]> {
    const directory = new Directory(uri);
    if (!directory.exists) return [];
    return directory.list().filter(item => item instanceof Directory).map(item => item.uri.replace(/\/$/, ''));
  }

  async copyFile(source: string, destination: string): Promise<void> {
    const target = new File(destination);
    if (target.exists) target.delete();
    await new File(source).copy(target);
  }

  async readText(uri: string): Promise<string | null> {
    const file = new File(uri);
    return file.exists ? file.text() : null;
  }

  async writeText(uri: string, value: string): Promise<void> {
    const file = new File(uri);
    if (!file.exists) file.create({ intermediates: true, overwrite: true });
    file.write(value);
  }

  async removeFile(uri: string): Promise<void> {
    const file = new File(uri);
    if (file.exists) file.delete();
  }
}

const defaultRoots = (): BackupStorageRoots => ({
  operations: new Directory(Paths.cache, 'novel-tracker-backup-operations').uri.replace(/\/$/, ''),
  generations: new Directory(Paths.document, 'novel-tracker-restored-images').uri.replace(/\/$/, ''),
  preferences: new Directory(Paths.document, 'novel-tracker-preferences').uri.replace(/\/$/, ''),
});

export class BackupFileStorage {
  private readonly roots: BackupStorageRoots;

  constructor(
    private readonly backend: BackupStorageBackend = new ExpoBackupStorageBackend(),
    roots?: BackupStorageRoots,
  ) {
    this.roots = roots ?? defaultRoots();
  }

  async createOperation(kind: 'export' | 'restore', id: string): Promise<BackupOperation> {
    await this.backend.ensureDirectory(this.roots.operations);
    const directoryUri = join(this.roots.operations, `${kind}-${id}`);
    await this.backend.ensureDirectory(directoryUri);
    return { id, directoryUri, archiveUri: join(directoryUri, 'NovelTracker.noveltracker') };
  }

  async createRestoreGeneration(id: string): Promise<RestoreGeneration> {
    await this.backend.ensureDirectory(this.roots.generations);
    const directoryUri = join(this.roots.generations, id);
    await this.backend.ensureDirectory(directoryUri);
    return { id, directoryUri };
  }

  async copyValidatedImages(archive: ValidatedBackupArchive, generation: RestoreGeneration): Promise<ReadonlyMap<string, string>> {
    const imageDirectory = join(generation.directoryUri, 'images');
    await this.backend.ensureDirectory(imageDirectory);
    const paths = new Map<string, string>();
    for (const image of archive.manifest.images) {
      if (paths.has(image.id)) continue;
      const source = archive.imagePaths.get(image.id);
      if (!source) throw new Error(`缺少恢复图片：${image.id}`);
      const destination = join(imageDirectory, `${encodeURIComponent(image.id)}.${image.extension}`);
      await this.backend.copyFile(source, destination);
      paths.set(image.id, destination);
    }
    return paths;
  }

  async removeOperation(id: string): Promise<void> {
    const directories = await this.backend.listDirectories(this.roots.operations);
    await Promise.all(directories.filter(uri => uri.endsWith(`-${id}`)).map(uri => this.backend.removeTree(uri)));
  }

  async removeGeneration(id: string): Promise<void> {
    await this.backend.removeTree(join(this.roots.generations, id));
  }

  async cleanupObsolete(activePaths: readonly string[]): Promise<void> {
    const active = new Set(activePaths.map(path => path.replace(/\/$/, '')));
    const directories = await this.backend.listDirectories(this.roots.generations);
    await Promise.all(directories.filter(uri => !active.has(uri.replace(/\/$/, ''))).map(uri => this.backend.removeTree(uri)));
  }

  async cleanupStaleOperations(): Promise<void> {
    const directories = await this.backend.listDirectories(this.roots.operations);
    await Promise.all(directories.map(uri => this.backend.removeTree(uri)));
    const pendingUri = join(this.roots.preferences, 'pending-cleanup.json');
    const pending = await this.backend.readText(pendingUri);
    if (pending) {
      try {
        const paths = JSON.parse(pending) as unknown;
        if (Array.isArray(paths) && paths.every(path => typeof path === 'string')) {
          await this.removeFiles(paths);
          await this.backend.removeFile(pendingUri);
        }
      } catch {
        // Keep the record for a later retry.
      }
    }
  }

  async removeFiles(paths: readonly string[]): Promise<void> {
    await Promise.all(paths.map(path => this.backend.removeFile(path)));
  }

  async deferFileCleanup(paths: readonly string[]): Promise<void> {
    const pendingUri = join(this.roots.preferences, 'pending-cleanup.json');
    const previous = await this.backend.readText(pendingUri);
    let queued: string[] = [];
    if (previous) {
      try {
        const parsed = JSON.parse(previous) as unknown;
        if (Array.isArray(parsed)) queued = parsed.filter(path => typeof path === 'string') as string[];
      } catch { /* replace a damaged record */ }
    }
    queued = [...new Set([...queued, ...paths])];
    await this.backend.ensureDirectory(this.roots.preferences);
    await this.backend.writeText(pendingUri, JSON.stringify(queued));
  }

  async getLastGeneratedAt(): Promise<string | null> {
    const value = await this.backend.readText(join(this.roots.preferences, 'last-generated.txt'));
    if (!value || Number.isNaN(Date.parse(value))) return null;
    return value;
  }

  async setLastGeneratedAt(value: string): Promise<void> {
    if (Number.isNaN(Date.parse(value))) throw new Error('备份时间无效');
    await this.backend.ensureDirectory(this.roots.preferences);
    await this.backend.writeText(join(this.roots.preferences, 'last-generated.txt'), value);
  }
}
