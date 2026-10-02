import type { BackupArchive, BackupArchiveProgress, ValidatedBackupArchive } from './backupArchive';
import type { BackupFileStorage } from './backupFileStorage';
import type { SqliteBackupRepository } from './backupRepository';
import type { BackupCounts, BackupManifestV1, BackupProgressStage } from './backupTypes';
import { BackupValidationError } from './backupValidation';

export type BackupProgress = { stage: BackupProgressStage; processedBytes?: number; totalBytes?: number };
export type GeneratedBackup = { operationId: string; uri: string };
export type BackupInspection = {
  token: string;
  sourceUri: string;
  manifest: BackupManifestV1;
  counts: BackupCounts;
  stagingOperationId: string;
};

type InspectionState = { publicValue: BackupInspection; archive: ValidatedBackupArchive; stagingOperationId: string };

function cloneManifest(manifest: BackupManifestV1): BackupManifestV1 {
  return JSON.parse(JSON.stringify(manifest)) as BackupManifestV1;
}

export class BackupService {
  private busy = false;
  private readonly inspections = new Map<string, InspectionState>();

  constructor(
    private readonly repository: SqliteBackupRepository,
    private readonly archive: BackupArchive,
    private readonly storage: BackupFileStorage,
    private readonly appVersion: string,
    private readonly idFactory: () => string,
    private readonly nowFactory: () => string = () => new Date().toISOString(),
  ) {}

  private async exclusive<T>(task: () => Promise<T>): Promise<T> {
    if (this.busy) throw new BackupValidationError('busy', '已有备份操作正在进行');
    this.busy = true;
    try { return await task(); } finally { this.busy = false; }
  }

  async getOverview(): Promise<{ counts: BackupCounts; lastGeneratedAt: string | null }> {
    const [counts, lastGeneratedAt] = await Promise.all([this.repository.getOverview(), this.storage.getLastGeneratedAt()]);
    return { counts, lastGeneratedAt };
  }

  async createBackup(onProgress?: (progress: BackupProgress) => void): Promise<GeneratedBackup> {
    return this.exclusive(async () => {
      const operationId = this.idFactory();
      const operation = await this.storage.createOperation('export', operationId);
      const exportedAt = this.nowFactory();
      try {
        onProgress?.({ stage: 'collecting' });
        const snapshot = await this.repository.createSnapshot(this.appVersion, exportedAt);
        await this.archive.write(snapshot, operation.archiveUri, progress => onProgress?.(this.archiveProgress(progress)));
        await this.storage.setLastGeneratedAt(exportedAt);
        return { operationId, uri: operation.archiveUri };
      } catch (error) {
        await this.storage.removeOperation(operationId).catch(() => undefined);
        throw error;
      }
    });
  }

  async releaseGeneratedBackup(operationId: string): Promise<void> {
    await this.storage.removeOperation(operationId);
  }

  async inspectBackup(sourceUri: string, onProgress?: (progress: BackupProgress) => void): Promise<BackupInspection> {
    return this.exclusive(async () => {
      const operationId = this.idFactory();
      const operation = await this.storage.createOperation('restore', operationId);
      try {
        onProgress?.({ stage: 'validating' });
        const archive = await this.archive.inspect(sourceUri, `${operation.directoryUri}/extracted`, progress => onProgress?.(this.archiveProgress(progress)));
        const token = this.idFactory();
        const protectedArchive: ValidatedBackupArchive = {
          manifest: cloneManifest(archive.manifest),
          imagePaths: new Map(archive.imagePaths),
        };
        const publicValue: BackupInspection = {
          token, sourceUri, manifest: cloneManifest(archive.manifest), counts: { ...archive.manifest.counts }, stagingOperationId: operationId,
        };
        this.inspections.set(token, { publicValue, archive: protectedArchive, stagingOperationId: operationId });
        return publicValue;
      } catch (error) {
        await this.storage.removeOperation(operationId).catch(() => undefined);
        throw error;
      }
    });
  }

  async restore(token: string, onProgress?: (progress: BackupProgress) => void): Promise<void> {
    await this.exclusive(async () => {
      const state = this.inspections.get(token);
      if (!state) throw new BackupValidationError('invalid_file', '恢复预览已失效，请重新选择备份');
      const generationId = this.idFactory();
      const generation = await this.storage.createRestoreGeneration(generationId);
      let committed = false;
      try {
        onProgress?.({ stage: 'staging' });
        const restoredPaths = await this.storage.copyValidatedImages(state.archive, generation);
        onProgress?.({ stage: 'restoring' });
        const oldPaths = await this.repository.replaceAll(state.archive.manifest, restoredPaths);
        committed = true;
        this.inspections.delete(token);
        onProgress?.({ stage: 'cleaning' });
        await this.storage.removeOperation(state.stagingOperationId).catch(() => undefined);
        try {
          await this.storage.removeFiles(oldPaths);
        } catch {
          await this.storage.deferFileCleanup(oldPaths).catch(() => undefined);
        }
        await this.storage.cleanupObsolete([generation.directoryUri]).catch(() => undefined);
      } catch (error) {
        if (!committed) await this.storage.removeGeneration(generationId).catch(() => undefined);
        throw error;
      }
    });
  }

  async cancelInspection(token: string): Promise<void> {
    const state = this.inspections.get(token);
    if (!state) return;
    this.inspections.delete(token);
    await this.storage.removeOperation(state.stagingOperationId);
  }

  async cleanupStaleOperations(): Promise<void> {
    await this.storage.cleanupStaleOperations();
  }

  private archiveProgress(progress: BackupArchiveProgress): BackupProgress {
    return { stage: progress.stage, processedBytes: progress.processedBytes, totalBytes: progress.totalBytes };
  }
}
