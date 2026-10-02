import { randomUUID } from 'expo-crypto';
import { fetch as expoFetch } from 'expo/fetch';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import type { ImageAsset } from './types';

export const MAX_COVER_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export type StagedCover = { uri: string; extension: string };
export type CoverFetchResponse = {
  ok: boolean;
  status: number;
  url?: string;
  headers: { get(name: string): string | null };
  body?: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel?: () => Promise<void> } } | null;
  arrayBuffer(): Promise<ArrayBuffer>;
};
export type CoverFetch = (url: string, init?: { redirect?: 'manual' | 'follow'; signal?: AbortSignal }) => Promise<CoverFetchResponse>;
type CoverFileSystem = {
  documentDirectory?: string | null;
  cacheDirectory?: string | null;
  makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void>;
  copyAsync(options: { from: string; to: string }): Promise<void>;
  writeAsStringAsync(uri: string, contents: string, options?: { encoding?: string }): Promise<void>;
  deleteAsync(uri: string, options?: { idempotent?: boolean }): Promise<void>;
  getInfoAsync(uri: string): Promise<{ exists: boolean; size?: number }>;
};

function extensionFromUri(uri: string): string {
  const extension = uri.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  return extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : 'jpg';
}

function base64FromBytes(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  if (typeof btoa !== 'function') throw new Error('当前环境不支持图片编码');
  return btoa(binary);
}

function assertCoverSize(size: number | undefined): void {
  if (size !== undefined && size > MAX_COVER_BYTES) throw new Error('封面图片不能超过 10 MB');
}

function assertImageBytes(bytes: ArrayBuffer | Uint8Array, extension: string): void {
  const data = new Uint8Array(bytes);
  const starts = (values: number[]) => values.every((value, index) => data[index] === value);
  const valid = extension === 'png' ? starts([0x89, 0x50, 0x4e, 0x47])
    : extension === 'jpg' ? starts([0xff, 0xd8, 0xff])
      : extension === 'gif' ? starts([0x47, 0x49, 0x46, 0x38])
        : extension === 'webp' ? starts([0x52, 0x49, 0x46, 0x46]) && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
          : true;
  if (!valid) throw new Error('下载的内容不是有效图片');
}

async function readResponseBytes(response: CoverFetchResponse): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = next.value ?? new Uint8Array();
      total += chunk.byteLength;
      assertCoverSize(total);
      chunks.push(chunk);
    }
  } finally {
    if (reader.cancel) await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export class BookCoverFiles {
  constructor(
    private readonly fileSystem: CoverFileSystem = FileSystem,
    private readonly idFactory: () => string = randomUUID,
    private readonly fetchImpl: CoverFetch = expoFetch as unknown as CoverFetch,
    private readonly decodeImage: (uri: string) => Promise<unknown> = async uri => ExpoImage.loadAsync(uri),
  ) {}

  private async stagingPath(id: string, extension: string): Promise<string> {
    const base = this.fileSystem.cacheDirectory ?? this.fileSystem.documentDirectory;
    if (!base) throw new Error('无法打开图片暂存目录');
    const directory = `${base}novel-tracker/staging/`;
    await this.fileSystem.makeDirectoryAsync(directory, { intermediates: true });
    return `${directory}${id}.${extension}`;
  }

  async stageFromPicker(uri: string): Promise<StagedCover> {
    const extension = extensionFromUri(uri);
    const stagedUri = await this.stagingPath(this.idFactory(), extension);
    try {
      await this.fileSystem.copyAsync({ from: uri, to: stagedUri });
      const info = await this.fileSystem.getInfoAsync(stagedUri);
      assertCoverSize(info.exists ? info.size : undefined);
      await this.decodeImage(stagedUri);
      return { uri: stagedUri, extension };
    } catch (error) {
      await this.fileSystem.deleteAsync(stagedUri, { idempotent: true }).catch(() => undefined);
      throw error;
    }
  }

  async stageFromUrl(input: string): Promise<StagedCover> {
    let nextUrl = input.trim();
    if (!nextUrl) throw new Error('请输入封面图片链接');
    let response: CoverFetchResponse | null = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    let bytes: Uint8Array;
    let extension: string;
    try {
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        let parsed: URL;
        try { parsed = new URL(nextUrl); } catch { throw new Error('封面链接格式无效'); }
        if (parsed.protocol !== 'https:') throw new Error('封面链接必须使用 HTTPS');
        response = await this.fetchImpl(nextUrl, { redirect: 'manual', signal: controller.signal });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location || redirects === MAX_REDIRECTS) throw new Error('封面链接重定向次数过多');
          nextUrl = new URL(location, nextUrl).toString();
          continue;
        }
        break;
      }
      if (!response || !response.ok) throw new Error('无法下载封面图片');
      const finalUrl = response.url ?? nextUrl;
      if (new URL(finalUrl).protocol !== 'https:') throw new Error('封面链接必须使用 HTTPS');
      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
      extension = IMAGE_TYPES[contentType];
      if (!extension) throw new Error('链接内容不是支持的图片格式');
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength)) assertCoverSize(declaredLength);
      bytes = await readResponseBytes(response);
      assertCoverSize(bytes.byteLength);
      assertImageBytes(bytes, extension);
    } catch (error) {
      if (controller.signal.aborted) throw new Error('下载封面图片超时');
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
    const stagedUri = await this.stagingPath(this.idFactory(), extension);
    try {
      await this.fileSystem.writeAsStringAsync(stagedUri, base64FromBytes(bytes), { encoding: 'base64' });
      await this.decodeImage(stagedUri);
      return { uri: stagedUri, extension };
    } catch (error) {
      await this.fileSystem.deleteAsync(stagedUri, { idempotent: true }).catch(() => undefined);
      throw error;
    }
  }

  async copyToBook(stage: StagedCover, bookId: string, imageId: string): Promise<ImageAsset> {
    const base = this.fileSystem.documentDirectory ?? this.fileSystem.cacheDirectory;
    if (!base) throw new Error('无法打开图片存储目录');
    const directory = `${base}novel-tracker/${bookId}/`;
    await this.fileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const localPath = `${directory}${imageId}.${stage.extension}`;
    await this.fileSystem.copyAsync({ from: stage.uri, to: localPath });
    return { id: imageId, bookId, localPath, createdAt: new Date().toISOString() };
  }

  async discard(stage: StagedCover): Promise<void> {
    await this.removeFile(stage.uri);
  }

  async removeFile(uri: string): Promise<void> {
    await this.fileSystem.deleteAsync(uri, { idempotent: true });
  }
}
