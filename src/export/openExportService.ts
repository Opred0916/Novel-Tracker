import type { BackupFileStorage } from '../backup/backupFileStorage';
import type { SqliteBackupRepository } from '../backup/backupRepository';
import { BackupValidationError } from '../backup/backupValidation';
import type { OpenExportArchive } from './openExportArchive';
import type { OpenExportProgress } from './openExportTypes';
import type { BackupCounts } from '../backup/backupTypes';

const pad = (value: number): string => String(value).padStart(2, '0');
const filenameDate = (date: Date): string => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

export class OpenExportService {
  private busy = false;

  constructor(
    private readonly repository: SqliteBackupRepository,
    private readonly archive: OpenExportArchive,
    private readonly storage: BackupFileStorage,
    private readonly appVersion: string,
    private readonly idFactory: () => string,
    private readonly nowFactory: () => Date = () => new Date(),
  ) {}

  async getOverview(): Promise<BackupCounts> {
    return this.repository.getOverview();
  }

  async createExport(onProgress?: (progress: OpenExportProgress) => void): Promise<{ operationId: string; uri: string }> {
    if (this.busy) throw new BackupValidationError('busy', '已有开放导出正在进行');
    this.busy = true;
    const operationId = this.idFactory();
    let operation: { id: string; directoryUri: string; archiveUri: string } | null = null;
    try {
      operation = await this.storage.createOperation('export', operationId);
      const now = this.nowFactory();
      const exportedAt = now.toISOString();
      onProgress?.({ stage: 'collecting' });
      const snapshot = await this.repository.createSnapshot(this.appVersion, exportedAt);
      const uri = `${operation.directoryUri.replace(/\/$/, '')}/NovelTracker-export-${filenameDate(now)}.zip`;
      await this.archive.write(snapshot, uri, progress => onProgress?.(progress));
      return { operationId, uri };
    } catch (error) {
      try {
        await this.storage.removeOperation(operationId);
      } catch {
        throw new BackupValidationError('export_failed', '导出失败且临时文件清理失败，请稍后重试');
      }
      throw error;
    } finally {
      this.busy = false;
    }
  }

  async releaseExport(operationId: string): Promise<void> {
    await this.storage.removeOperation(operationId);
  }
}
