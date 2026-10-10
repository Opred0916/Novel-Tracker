import type { Database } from '../storage/database';

type SyncRow = { local_revision: number; remote_revision: number; baseline_json: string | null };

export class LocalSyncStore {
  constructor(private readonly db: Database) {}

  private async row(): Promise<SyncRow> {
    const row = await this.db.getFirstAsync<SyncRow>('SELECT local_revision, remote_revision, baseline_json FROM sync_state WHERE id = 1');
    if (!row) throw new Error('同步状态尚未初始化');
    return row;
  }

  async readLocalRevision(): Promise<number> { return (await this.row()).local_revision; }

  async readBaseline(): Promise<{ remoteRevision: number; manifestJson: string } | null> {
    const row = await this.row();
    return row.baseline_json === null ? null : { remoteRevision: row.remote_revision, manifestJson: row.baseline_json };
  }

  async saveBaseline(remoteRevision: number, manifestJson: string): Promise<void> {
    if (!Number.isSafeInteger(remoteRevision) || remoteRevision < 0) throw new Error('无效的云端版本');
    await this.db.runAsync('UPDATE sync_state SET remote_revision = ?, baseline_json = ? WHERE id = 1', remoteRevision, manifestJson);
  }
}
