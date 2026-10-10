import type { BackupImageEntry } from '../backup/backupTypes';
import type { BackupImageSource } from '../backup/backupRepository';
import { accountImageDirectory } from '../account/accountStorage';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif' };

export type CloudImageStore = {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  download(path: string): Promise<Uint8Array>;
};

export type ImageFilePort = {
  read(localPath: string): Promise<Uint8Array>;
  write(userId: string, entry: BackupImageEntry, bytes: Uint8Array): Promise<string>;
  size(localPath: string): Promise<number | null>;
};

export function imageCloudPath(userId: string, entry: BackupImageEntry): string {
  accountImageDirectory(userId);
  if (!entry.id || !/^[A-Za-z0-9]{1,10}$/.test(entry.extension)) throw new Error('无效的图片标识');
  return `${userId.toLowerCase()}/${encodeURIComponent(entry.id)}.${entry.extension.toLowerCase()}`;
}

function assertLength(bytes: Uint8Array, expected?: number): void {
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('图片超过 10 MB 限制');
  if (expected !== undefined && bytes.byteLength !== expected) throw new Error('图片大小不匹配');
}

export class ImageTransport {
  constructor(private readonly cloud: CloudImageStore, private readonly files: ImageFilePort) {}

  async uploadMissingImages(userId: string, sources: BackupImageSource[], remoteImages: BackupImageEntry[]): Promise<BackupImageEntry[]> {
    const remote = new Map(remoteImages.map(image => [image.id, image]));
    const entries: BackupImageEntry[] = [];
    for (const source of sources) {
      const bytes = await this.files.read(source.localPath);
      assertLength(bytes);
      const entry: BackupImageEntry = {
        id: source.id, bookId: source.bookId, createdAt: source.createdAt,
        extension: source.extension.toLowerCase(), byteLength: bytes.byteLength, archivePath: source.archivePath,
      };
      const existing = remote.get(entry.id);
      if (existing) {
        if (existing.byteLength !== entry.byteLength || existing.extension !== entry.extension) throw new Error('同一图片在云端和本机内容不一致');
      } else {
        const mime = MIME[entry.extension];
        if (!mime) throw new Error('不支持的图片格式');
        await this.cloud.upload(imageCloudPath(userId, entry), bytes, mime);
      }
      entries.push(entry);
    }
    return entries;
  }

  async downloadMissingImages(userId: string, entries: BackupImageEntry[], knownPaths: ReadonlyMap<string, string>): Promise<Map<string, string>> {
    const paths = new Map<string, string>();
    for (const entry of entries) {
      if (entry.byteLength > MAX_IMAGE_BYTES) throw new Error('图片超过 10 MB 限制');
      const known = knownPaths.get(entry.id);
      if (known && await this.files.size(known) === entry.byteLength) {
        paths.set(entry.id, known);
        continue;
      }
      const bytes = await this.cloud.download(imageCloudPath(userId, entry));
      assertLength(bytes, entry.byteLength);
      paths.set(entry.id, await this.files.write(userId, entry, bytes));
    }
    return paths;
  }
}
