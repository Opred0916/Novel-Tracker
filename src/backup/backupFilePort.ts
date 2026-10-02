import { File, Paths } from 'expo-file-system';

export const BACKUP_CHUNK_SIZE = 256 * 1024;

export type BackupFileStat = { exists: boolean; size: number };

export type BackupChunkWriter = {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
};

export interface BackupFilePort {
  stat(uri: string): Promise<BackupFileStat>;
  readChunks(uri: string, chunkSize: number): AsyncIterable<Uint8Array>;
  openChunkWriter(uri: string): Promise<BackupChunkWriter>;
  remove(uri: string): Promise<void>;
  availableDiskSpace(): Promise<number>;
}

export class ExpoBackupFilePort implements BackupFilePort {
  async stat(uri: string): Promise<BackupFileStat> {
    const file = new File(uri);
    return { exists: file.exists, size: file.exists ? (file.size ?? 0) : 0 };
  }

  async *readChunks(uri: string, chunkSize: number): AsyncIterable<Uint8Array> {
    const reader = new File(uri).readableStream().getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (let offset = 0; offset < value.length; offset += chunkSize) yield value.slice(offset, offset + chunkSize);
      }
    } finally {
      try { await reader.cancel(); } catch { /* stream may already be closed */ }
      reader.releaseLock();
    }
  }

  async openChunkWriter(uri: string): Promise<BackupChunkWriter> {
    const file = new File(uri);
    if (file.exists) file.delete();
    file.create({ intermediates: true, overwrite: true });
    const writer = file.writableStream().getWriter();
    return {
      write: async chunk => { await writer.write(chunk); },
      close: async () => { await writer.close(); },
    };
  }

  async remove(uri: string): Promise<void> {
    const file = new File(uri);
    if (file.exists) file.delete();
  }

  async availableDiskSpace(): Promise<number> {
    return Paths.availableDiskSpace;
  }
}
