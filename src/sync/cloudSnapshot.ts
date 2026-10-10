import type { SupabaseClient } from '@supabase/supabase-js';
import type { BackupManifestV4 } from '../backup/backupTypes';
import { validateBackupManifest } from '../backup/backupValidation';

export type CloudSnapshot = { revision: number; manifest: BackupManifestV4 };
export class CloudConflictError extends Error { constructor() { super('云端记录已更新，请重新合并'); } }

export interface CloudSnapshotStore {
  read(): Promise<CloudSnapshot | null>;
  commit(expectedRevision: number, manifest: BackupManifestV4): Promise<number>;
}

export class SupabaseSnapshotStore implements CloudSnapshotStore {
  constructor(private readonly client: SupabaseClient, private readonly userId: string) {}

  async read(): Promise<CloudSnapshot | null> {
    const { data, error } = await this.client.from('library_snapshots').select('revision, manifest').eq('user_id', this.userId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const manifest = validateBackupManifest(data.manifest) as unknown as BackupManifestV4;
    if (manifest.formatVersion !== 4) throw new Error('云端书库格式尚不支持');
    if (!Number.isSafeInteger(data.revision) || data.revision <= 0) throw new Error('云端版本无效');
    return { revision: data.revision, manifest };
  }

  async commit(expectedRevision: number, manifest: BackupManifestV4): Promise<number> {
    const { data, error } = await this.client.rpc('commit_library_snapshot', { expected_revision: expectedRevision, next_manifest: manifest });
    if (error?.code === '40001') throw new CloudConflictError();
    if (error) throw error;
    if (!Number.isSafeInteger(data) || data <= expectedRevision) throw new Error('云端未确认保存');
    return data as number;
  }
}
