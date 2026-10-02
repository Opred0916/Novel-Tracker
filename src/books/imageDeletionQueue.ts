import * as FileSystem from 'expo-file-system/legacy';
import type { Database } from '../storage/database';

export type ImageDeletionFilePort = {
  removeFile(localPath: string): Promise<void>;
};

type PendingPath = { local_path: string };

const defaultFiles: ImageDeletionFilePort = {
  removeFile: localPath => FileSystem.deleteAsync(localPath, { idempotent: true }),
};

function normalizeRoot(root: string): URL | null {
  try {
    const parsed = new URL(root.endsWith('/') ? root : `${root}/`);
    if (parsed.protocol !== 'file:' || parsed.search || parsed.hash) return null;
    parsed.pathname = parsed.pathname.replace(/\/+/g, '/');
    if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
    return parsed;
  } catch {
    return null;
  }
}

function hasTraversal(path: string): boolean {
  return /(?:^|\/)(?:\.{1,2}|%2e(?:%2e)?)(?:\/|$)/i.test(path);
}

function isManagedFile(localPath: string, roots: readonly URL[]): boolean {
  if (!localPath || localPath.includes('?') || localPath.includes('#') || hasTraversal(localPath)) return false;
  let parsed: URL;
  try { parsed = new URL(localPath); } catch { return false; }
  if (parsed.protocol !== 'file:') return false;
  const pathname = decodeURIComponent(parsed.pathname).replace(/\/+/g, '/');
  if (pathname.endsWith('/')) return false;
  return roots.some(root => parsed.origin === root.origin && pathname.startsWith(root.pathname));
}

export class ImageDeletionQueue {
  private readonly roots: readonly URL[];

  constructor(
    private readonly db: Database,
    private readonly files: ImageDeletionFilePort = defaultFiles,
    managedRoots: readonly string[] = [],
  ) {
    this.roots = managedRoots.map(normalizeRoot).filter((root): root is URL => root !== null);
  }

  async enqueue(txn: Pick<Database, 'runAsync'>, paths: readonly string[]): Promise<void> {
    for (const path of new Set(paths.filter(Boolean))) {
      await txn.runAsync('INSERT OR IGNORE INTO pending_image_deletions (local_path) VALUES (?)', path);
    }
  }

  async drain(): Promise<void> {
    const pending = await this.db.getAllAsync<PendingPath>('SELECT local_path FROM pending_image_deletions ORDER BY local_path ASC');
    for (const { local_path: localPath } of pending) {
      if (!isManagedFile(localPath, this.roots)) continue;
      try {
        const reference = await this.db.getFirstAsync<{ id: string }>('SELECT id FROM image_assets WHERE local_path = ? LIMIT 1', localPath);
        if (reference) continue;
        await this.files.removeFile(localPath);
        await this.db.runAsync('DELETE FROM pending_image_deletions WHERE local_path = ?', localPath);
      } catch {
        // Keep failed paths for a later retry; one locked file must not block others.
      }
    }
  }
}
