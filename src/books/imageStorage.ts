import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import type { ImageAsset } from './types';

export class ImageStorage {
  constructor(private readonly idFactory: () => string = randomUUID, private readonly directoryName = 'novel-tracker') {}

  async copyFromPicker(uri: string, bookId: string): Promise<ImageAsset> {
    const id = this.idFactory();
    const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    if (!base) throw new Error('无法打开图片存储目录');
    const directory = `${base}${this.directoryName}/${bookId}/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const extension = uri.split('?')[0].split('.').pop() || 'jpg';
    const localPath = `${directory}${id}.${extension}`;
    await FileSystem.copyAsync({ from: uri, to: localPath });
    return { id, bookId, localPath, createdAt: new Date().toISOString() };
  }

  async removeFile(localPath: string): Promise<void> {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
  }
}
