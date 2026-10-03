import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import type { BackupChunkWriter, BackupFilePort } from '../backup/backupFilePort';
import type { BackupImageEntry, BackupManifestV1, BackupManifestV3 } from '../backup/backupTypes';
import type { BackupSnapshot } from '../backup/backupRepository';
import { BackupValidationError, countsFromManifest, isSafeArchivePath, validateBackupManifest } from '../backup/backupValidation';
import { CURRENT_BACKUP_FORMAT_VERSION } from '../backup/backupTypes';
import { createOpenExportFiles } from './openExportSerializer';
import { OPEN_EXPORT_TEXT_NAMES, type OpenExportProgress } from './openExportTypes';

type Limits = { maxImages: number; maxJsonBytes: number; maxUncompressedBytes: number };
const DEFAULT_LIMITS: Limits = { maxImages: 20_000, maxJsonBytes: 10 * 1024 * 1024, maxUncompressedBytes: 2 * 1024 * 1024 * 1024 };
const CHUNK_SIZE = 256 * 1024;

const archivePathFor = (id: string, extension: string): string => `images/${encodeURIComponent(id)}.${extension}`;

export class OpenExportArchive {
  private readonly limits: Limits;

  constructor(private readonly files: BackupFilePort, limits: Partial<Limits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  async write(snapshot: BackupSnapshot, destinationUri: string, onProgress?: (progress: OpenExportProgress) => void): Promise<void> {
    const unique = new Map<string, BackupSnapshot['images'][number]>();
    for (const image of snapshot.images) {
      const previous = unique.get(image.id);
      if (previous && (previous.localPath !== image.localPath || previous.bookId !== image.bookId || previous.extension !== image.extension)) {
        throw new BackupValidationError('invalid_value', `图片 ID 冲突：${image.id}`);
      }
      unique.set(image.id, image);
    }
    if (unique.size > this.limits.maxImages) throw new BackupValidationError('archive_too_large', '图片数量超过开放导出限制');

    const imageEntries: BackupImageEntry[] = [];
    let imageBytes = 0;
    for (const image of unique.values()) {
      const extension = image.extension.toLowerCase();
      const archivePath = archivePathFor(image.id, extension);
      if (!/^[A-Za-z0-9]{1,10}$/.test(extension) || !isSafeArchivePath(archivePath)) {
        throw new BackupValidationError('unsafe_path', `图片路径不安全：${image.id}`);
      }
      const stat = await this.files.stat(image.localPath);
      if (!stat.exists) throw new BackupValidationError('image_missing', `找不到图片：${image.id}`);
      imageBytes += stat.size;
      imageEntries.push({ id: image.id, bookId: image.bookId, createdAt: image.createdAt, extension, byteLength: stat.size, archivePath });
    }

    const manifestInput = {
      formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: snapshot.exportedAt,
      appVersion: snapshot.appVersion,
      ...snapshot.data,
      images: imageEntries,
    } as unknown as BackupManifestV3;
    manifestInput.counts = countsFromManifest(manifestInput as unknown as BackupManifestV1);
    const manifest = validateBackupManifest(manifestInput) as unknown as BackupManifestV3;
    const textFiles = createOpenExportFiles(manifest);
    const jsonBytes = textFiles['library.json'].length;
    const textBytes = OPEN_EXPORT_TEXT_NAMES.reduce((sum, name) => sum + textFiles[name].length, 0);
    const totalBytes = textBytes + imageBytes;
    if (jsonBytes > this.limits.maxJsonBytes || totalBytes > this.limits.maxUncompressedBytes) {
      throw new BackupValidationError('archive_too_large', '开放导出内容超过安全限制');
    }
    if (totalBytes > await this.files.availableDiskSpace()) throw new BackupValidationError('storage_insufficient', '设备空间不足');

    let writer: BackupChunkWriter | null = null;
    let chain = Promise.resolve();
    let finalResolve!: () => void;
    let finalReject!: (error: Error) => void;
    const finished = new Promise<void>((resolve, reject) => { finalResolve = resolve; finalReject = reject; });
    try {
      writer = await this.files.openChunkWriter(destinationUri);
      const zip = new Zip((error, data, final) => {
        if (error) { finalReject(error); return; }
        chain = chain.then(() => writer!.write(data));
        if (final) finalResolve();
      });
      for (const name of OPEN_EXPORT_TEXT_NAMES) {
        const file = new ZipDeflate(name, { level: name.endsWith('.csv') || name === 'README.txt' ? 6 : 0 });
        zip.add(file);
        file.push(textFiles[name], true);
      }
      let processedBytes = 0;
      onProgress?.({ stage: 'packing', processedBytes, totalBytes });
      for (const image of imageEntries) {
        const source = unique.get(image.id)!;
        const file = new ZipPassThrough(image.archivePath);
        zip.add(file);
        for await (const chunk of this.files.readChunks(source.localPath, CHUNK_SIZE)) {
          processedBytes += chunk.length;
          file.push(chunk, false);
          onProgress?.({ stage: 'packing', processedBytes, totalBytes });
        }
        file.push(new Uint8Array(), true);
      }
      zip.end();
      await finished;
      await chain;
      await writer.close();
      writer = null;
    } catch (error) {
      if (writer) { try { await writer.close(); } catch { /* cleanup below */ } }
      await this.files.remove(destinationUri).catch(() => undefined);
      throw error;
    }
  }
}
