import { strFromU8, strToU8, Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import type { BackupSnapshot } from './backupRepository';
import {
  MAX_ARCHIVE_ENTRIES,
  MAX_MANIFEST_BYTES,
  MAX_UNCOMPRESSED_BYTES,
  type BackupImageEntry,
  type BackupManifestV1,
} from './backupTypes';
import { BackupValidationError, countsFromManifest, isSafeArchivePath, validateBackupManifest } from './backupValidation';
import { BACKUP_CHUNK_SIZE, type BackupChunkWriter, type BackupFilePort } from './backupFilePort';

export type BackupArchiveProgress = { stage: 'packing' | 'validating'; processedBytes: number; totalBytes?: number };
export type ValidatedBackupArchive = { manifest: BackupManifestV1; imagePaths: ReadonlyMap<string, string> };
type Limits = { maxEntries: number; maxManifestBytes: number; maxUncompressedBytes: number };

const DEFAULT_LIMITS: Limits = {
  maxEntries: MAX_ARCHIVE_ENTRIES,
  maxManifestBytes: MAX_MANIFEST_BYTES,
  maxUncompressedBytes: MAX_UNCOMPRESSED_BYTES,
};

const joinUri = (base: string, relative: string): string => `${base.replace(/\/$/, '')}/${relative}`;
const concat = (chunks: readonly Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
};

export class BackupArchive {
  private readonly limits: Limits;

  constructor(private readonly files: BackupFilePort, limits: Partial<Limits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  async write(snapshot: BackupSnapshot, destinationUri: string, onProgress?: (progress: BackupArchiveProgress) => void): Promise<void> {
    const uniqueImages = [...new Map(snapshot.images.map(image => [image.id, image])).values()];
    const imageEntries: BackupImageEntry[] = [];
    let totalBytes = 0;
    for (const image of uniqueImages) {
      const stat = await this.files.stat(image.localPath);
      if (!stat.exists) throw new BackupValidationError('image_missing', `找不到图片：${image.id}`);
      totalBytes += stat.size;
      imageEntries.push({
        id: image.id, bookId: image.bookId, createdAt: image.createdAt, extension: image.extension,
        byteLength: stat.size, archivePath: image.archivePath,
      });
    }
    const draft = {
      formatVersion: snapshot.formatVersion,
      exportedAt: snapshot.exportedAt,
      appVersion: snapshot.appVersion,
      ...snapshot.data,
      images: imageEntries,
    } as Omit<BackupManifestV1, 'counts'>;
    const manifest = validateBackupManifest({ ...draft, counts: countsFromManifest(draft as BackupManifestV1) });
    const manifestBytes = strToU8(JSON.stringify(manifest));
    if (manifestBytes.length > this.limits.maxManifestBytes || imageEntries.length + 1 > this.limits.maxEntries) {
      throw new BackupValidationError('archive_too_large', '备份内容超过安全上限');
    }

    let writer: BackupChunkWriter | null = null;
    let outputChain = Promise.resolve();
    let zipError: Error | null = null;
    let finishedResolve!: () => void;
    let finishedReject!: (error: Error) => void;
    const finished = new Promise<void>((resolve, reject) => { finishedResolve = resolve; finishedReject = reject; });
    try {
      writer = await this.files.openChunkWriter(destinationUri);
      const zip = new Zip((error, data, final) => {
        if (error) {
          zipError = error;
          finishedReject(error);
          return;
        }
        outputChain = outputChain.then(() => writer!.write(data));
        if (final) finishedResolve();
      });
      const manifestFile = new ZipDeflate('manifest.json', { level: 6 });
      zip.add(manifestFile);
      manifestFile.push(manifestBytes, true);
      let processedBytes = 0;
      onProgress?.({ stage: 'packing', processedBytes, totalBytes });
      for (const image of uniqueImages) {
        const file = new ZipPassThrough(image.archivePath);
        zip.add(file);
        for await (const chunk of this.files.readChunks(image.localPath, BACKUP_CHUNK_SIZE)) {
          processedBytes += chunk.length;
          file.push(chunk, false);
          onProgress?.({ stage: 'packing', processedBytes, totalBytes });
        }
        file.push(new Uint8Array(), true);
      }
      zip.end();
      await finished;
      await outputChain;
      if (zipError) throw zipError;
      await writer.close();
      writer = null;
    } catch (error) {
      if (writer) {
        try { await writer.close(); } catch { /* remove below */ }
      }
      await this.files.remove(destinationUri);
      throw error;
    }
  }

  async inspect(sourceUri: string, extractDirectoryUri: string, onProgress?: (progress: BackupArchiveProgress) => void): Promise<ValidatedBackupArchive> {
    const source = await this.files.stat(sourceUri);
    if (!source.exists) throw new BackupValidationError('invalid_file', '备份文件不存在');
    const freeSpace = await this.files.availableDiskSpace();
    const entryNames = new Set<string>();
    const manifestChunks: Uint8Array[] = [];
    const extracted = new Map<string, string>();
    const actualSizes = new Map<string, number>();
    const pending: Promise<void>[] = [];
    let entryCount = 0;
    let declaredTotal = 0;
    let actualTotal = 0;
    let streamError: Error | null = null;
    onProgress?.({ stage: 'validating', processedBytes: 0, totalBytes: source.size });

    const unzip = new Unzip(file => {
      if (streamError) return;
      try {
        entryCount += 1;
        if (entryCount > this.limits.maxEntries) throw new BackupValidationError('archive_too_large', '归档条目过多');
        if (entryNames.has(file.name)) throw new BackupValidationError('unsafe_path', '归档条目重复');
        entryNames.add(file.name);
        if (file.name !== 'manifest.json' && !isSafeArchivePath(file.name)) {
          const looksLikePathAttack = file.name.includes('..') || file.name.includes('\\') || file.name.startsWith('/') || /^[A-Za-z]:/.test(file.name);
          throw new BackupValidationError(looksLikePathAttack ? 'unsafe_path' : 'invalid_file', '归档包含未声明或不安全的文件');
        }
        if (file.originalSize !== undefined) {
          declaredTotal += file.originalSize;
          if (declaredTotal > this.limits.maxUncompressedBytes) throw new BackupValidationError('archive_too_large', '解压内容过大');
          if (declaredTotal > freeSpace) throw new BackupValidationError('storage_insufficient', '设备空间不足');
        }

        if (file.name === 'manifest.json') {
          let size = 0;
          file.ondata = (error, data) => {
            if (streamError) return;
            if (error) { streamError = error; return; }
            size += data.length;
            actualTotal += data.length;
            if (size > this.limits.maxManifestBytes || actualTotal > this.limits.maxUncompressedBytes) {
              streamError = new BackupValidationError('archive_too_large', '解压内容超过安全上限');
              return;
            }
            if (actualTotal > freeSpace) { streamError = new BackupValidationError('storage_insufficient', '设备空间不足'); return; }
            manifestChunks.push(data.slice());
          };
        } else {
          const uri = joinUri(extractDirectoryUri, file.name);
          extracted.set(file.name, uri);
          let size = 0;
          let chain = this.files.openChunkWriter(uri).then(async writer => {
            let writes = Promise.resolve();
            file.ondata = (error, data, final) => {
              if (streamError) return;
              if (error) { streamError = error; return; }
              size += data.length;
              actualTotal += data.length;
              if (actualTotal > this.limits.maxUncompressedBytes) { streamError = new BackupValidationError('archive_too_large', '解压内容过大'); return; }
              if (actualTotal > freeSpace) { streamError = new BackupValidationError('storage_insufficient', '设备空间不足'); return; }
              writes = writes.then(() => writer.write(data));
              if (final) writes = writes.then(() => writer.close());
            };
            file.start();
            await writes;
            actualSizes.set(file.name, size);
          });
          pending.push(chain.catch(error => { streamError = error as Error; }));
          return;
        }
        file.start();
      } catch (error) {
        streamError = error as Error;
        throw error;
      }
    });
    unzip.register(UnzipInflate);

    try {
      let readBytes = 0;
      let previousChunk: Uint8Array | null = null;
      for await (const chunk of this.files.readChunks(sourceUri, BACKUP_CHUNK_SIZE)) {
        if (previousChunk) {
          readBytes += previousChunk.length;
          unzip.push(previousChunk, false);
          onProgress?.({ stage: 'validating', processedBytes: readBytes, totalBytes: source.size });
          if (streamError) throw streamError;
        }
        previousChunk = chunk;
      }
      if (!previousChunk) throw new BackupValidationError('invalid_file', '备份文件为空');
      readBytes += previousChunk.length;
      unzip.push(previousChunk, true);
        onProgress?.({ stage: 'validating', processedBytes: readBytes, totalBytes: source.size });
      if (streamError) throw streamError;
      await Promise.all(pending);
      if (streamError) throw streamError;
      if (!entryNames.has('manifest.json')) throw new BackupValidationError('invalid_file', '缺少 manifest.json');
      let parsed: unknown;
      try { parsed = JSON.parse(strFromU8(concat(manifestChunks))); } catch { throw new BackupValidationError('invalid_manifest', 'manifest.json 不是有效 JSON'); }
      const manifest = validateBackupManifest(parsed);
      if (entryNames.size !== manifest.images.length + 1) throw new BackupValidationError('invalid_file', '归档包含未声明文件或缺少图片');
      const replacementImageBytes = manifest.images.reduce((sum, image) => sum + image.byteLength, 0);
      const requiredSpace = actualTotal + replacementImageBytes + 1024 * 1024;
      if (requiredSpace > freeSpace) throw new BackupValidationError('storage_insufficient', '设备空间不足，无法安全暂存并恢复图片');
      const imagePaths = new Map<string, string>();
      for (const image of manifest.images) {
        const uri = extracted.get(image.archivePath);
        if (!uri) throw new BackupValidationError('image_missing', `缺少图片：${image.id}`);
        if (actualSizes.get(image.archivePath) !== image.byteLength) throw new BackupValidationError('invalid_file', `图片大小不符：${image.id}`);
        imagePaths.set(image.id, uri);
      }
      return { manifest, imagePaths };
    } catch (error) {
      await Promise.all([...extracted.values()].map(uri => this.files.remove(uri).catch(() => undefined)));
      if (error instanceof BackupValidationError) throw error;
      throw new BackupValidationError('invalid_file', error instanceof Error ? error.message : '无法读取备份文件');
    }
  }
}
