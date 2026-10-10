import { decode, encode } from 'base64-arraybuffer';
import { Image as ExpoImage } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accountImageDirectory } from '../account/accountStorage';
import type { BackupImageEntry } from '../backup/backupTypes';
import type { CloudImageStore, ImageFilePort } from './imageTransport';

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

export class SupabaseImageStore implements CloudImageStore {
  constructor(private readonly client: SupabaseClient) {}

  async upload(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const { error } = await this.client.storage.from('library-images').upload(path, body, { contentType, upsert: false });
    if (!error) return;
    // A previous upload may have completed before its response was lost. Never overwrite it.
    if (String(error).includes('409') || /already exists|duplicate/i.test(error.message)) {
      const existing = await this.download(path);
      if (sameBytes(existing, bytes)) return;
      throw new Error('云端图片与本机同名图片不同');
    }
    throw error;
  }

  async download(path: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage.from('library-images').download(path);
    if (error || !data) throw error ?? new Error('无法下载图片');
    return new Uint8Array(await data.arrayBuffer());
  }
}

export class ExpoImageFilePort implements ImageFilePort {
  async read(localPath: string): Promise<Uint8Array> {
    const encoded = await FileSystem.readAsStringAsync(localPath, { encoding: 'base64' });
    return new Uint8Array(decode(encoded));
  }

  async size(localPath: string): Promise<number | null> {
    const info = await FileSystem.getInfoAsync(localPath);
    return info.exists ? info.size ?? null : null;
  }

  async write(userId: string, entry: BackupImageEntry, bytes: Uint8Array): Promise<string> {
    const root = FileSystem.documentDirectory;
    if (!root) throw new Error('无法打开图片存储目录');
    const directory = `${root}${accountImageDirectory(userId)}/${encodeURIComponent(entry.bookId)}/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const path = `${directory}${encodeURIComponent(entry.id)}.${entry.extension}`;
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    try {
      await FileSystem.writeAsStringAsync(path, encode(body), { encoding: 'base64' });
      await ExpoImage.loadAsync(path);
      return path;
    } catch (error) {
      await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
      throw error;
    }
  }
}
