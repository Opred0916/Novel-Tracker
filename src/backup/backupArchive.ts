import { strFromU8, strToU8, unzipSync, Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { Image as ExpoImage } from 'expo-image';
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

const u16 = (bytes: Uint8Array, offset: number): number => bytes[offset] | (bytes[offset + 1] << 8);
const u32 = (bytes: Uint8Array, offset: number): number => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); table[n] = c >>> 0; }
  return table;
})();
const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const validateZipIntegrity = (bytes: Uint8Array): void => {
  const unzipped = unzipSync(bytes);
  let eocd = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (u32(bytes, index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error('missing end of central directory');
  const count = u16(bytes, eocd + 10);
  const centralSize = u32(bytes, eocd + 12);
  const centralOffset = u32(bytes, eocd + 16);
  if (centralOffset + centralSize > eocd) throw new Error('invalid central directory');
  let offset = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (u32(bytes, offset) !== 0x02014b50) throw new Error('invalid central directory entry');
    const crc = u32(bytes, offset + 16);
    const nameLength = u16(bytes, offset + 28);
    const extraLength = u16(bytes, offset + 30);
    const commentLength = u16(bytes, offset + 32);
    const name = strFromU8(bytes.slice(offset + 46, offset + 46 + nameLength));
    const data = unzipped[name];
    if (!data || crc32(data) !== crc) throw new Error(`CRC mismatch: ${name}`);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== centralOffset + centralSize) throw new Error('invalid central directory size');
};

export class BackupArchive {
  private readonly limits: Limits;

  constructor(
    private readonly files: BackupFilePort,
    limits: Partial<Limits> = {},
    private readonly decodeImage: (uri: string) => Promise<unknown> = async uri => ExpoImage.loadAsync(uri),
  ) {
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
    } as unknown as Omit<BackupManifestV1, 'counts'>;
    const manifest = validateBackupManifest({ ...draft, counts: countsFromManifest(draft as BackupManifestV1) });
    const manifestBytes = strToU8(JSON.stringify(manifest));
    if (manifestBytes.length > this.limits.maxManifestBytes || imageEntries.length + 1 > this.limits.maxEntries
      || manifestBytes.length + totalBytes > this.limits.maxUncompressedBytes) {
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
    const archiveChunks: Uint8Array[] = [];
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
            let resolveComplete!: () => void;
            let rejectComplete!: (error: Error) => void;
            const complete = new Promise<void>((resolve, reject) => { resolveComplete = resolve; rejectComplete = reject; });
            let closed = false;
            const closeWriter = async () => {
              if (closed) return;
              closed = true;
              await writes;
              await writer.close();
            };
            file.ondata = (error, data, final) => {
              if (streamError) return;
              if (error) {
                streamError = error;
                rejectComplete(error);
                return;
              }
              size += data.length;
              actualTotal += data.length;
              if (actualTotal > this.limits.maxUncompressedBytes) {
                streamError = new BackupValidationError('archive_too_large', '解压内容过大');
                rejectComplete(streamError);
                return;
              }
              if (actualTotal > freeSpace) {
                streamError = new BackupValidationError('storage_insufficient', '设备空间不足');
                rejectComplete(streamError);
                return;
              }
              writes = writes.then(() => writer.write(data));
              if (final) void closeWriter().then(resolveComplete, rejectComplete);
            };
            try {
              file.start();
              await complete;
              actualSizes.set(file.name, size);
            } catch (error) {
              try { await closeWriter(); } catch { /* remove below */ }
              throw error;
            }
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
        archiveChunks.push(chunk.slice());
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
      try { validateZipIntegrity(concat(archiveChunks)); } catch { throw new BackupValidationError('invalid_file', '备份 ZIP 完整性校验失败'); }
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
      for (const book of manifest.books) {
        if (((manifest as unknown as { formatVersion: number }).formatVersion !== 2
          && (manifest as unknown as { formatVersion: number }).formatVersion !== 3) || !book.coverImageId) continue;
        const coverPath = imagePaths.get(book.coverImageId);
        if (!coverPath) throw new BackupValidationError('image_missing', `缺少封面图片：${book.id}`);
        try { await this.decodeImage(coverPath); }
        catch { throw new BackupValidationError('invalid_file', `封面图片无法读取：${book.id}`); }
      }
      return { manifest, imagePaths };
    } catch (error) {
      await Promise.all([...extracted.values()].map(uri => this.files.remove(uri).catch(() => undefined)));
      if (error instanceof BackupValidationError) throw error;
      throw new BackupValidationError('invalid_file', error instanceof Error ? error.message : '无法读取备份文件');
    }
  }
}
