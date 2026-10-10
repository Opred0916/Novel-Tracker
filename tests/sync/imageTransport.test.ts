import { ImageTransport, imageCloudPath } from '../../src/sync/imageTransport';
import type { BackupImageEntry } from '../../src/backup/backupTypes';

const userId = '8c53bb6d-51e7-4795-b4dc-327c836b7f90';
const entry: BackupImageEntry = { id: 'image-1', bookId: 'book-1', createdAt: '2026-10-10T00:00:00.000Z', extension: 'png', byteLength: 4, archivePath: 'images/image-1.png' };
const bytes = new Uint8Array([1, 2, 3, 4]);

test('cloud path is owner-scoped and rejects untrusted IDs', () => {
  expect(imageCloudPath(userId, entry)).toBe(`${userId}/image-1.png`);
  expect(() => imageCloudPath('../other', entry)).toThrow();
  expect(() => imageCloudPath(userId, { ...entry, extension: '../png' })).toThrow();
});

test('uploads new image bytes before returning a manifest entry', async () => {
  const store = { upload: jest.fn(async () => undefined), download: jest.fn() };
  const files = { read: jest.fn(async () => bytes), write: jest.fn(), size: jest.fn() };
  const transport = new ImageTransport(store, files);
  const result = await transport.uploadMissingImages(userId, [{ ...entry, localPath: 'file:///local.png' }], []);
  expect(store.upload).toHaveBeenCalledWith(`${userId}/image-1.png`, bytes, 'image/png');
  expect(result).toEqual([entry]);
});

test('failed upload cannot produce a publishable manifest', async () => {
  const store = { upload: jest.fn(async () => { throw new Error('offline'); }), download: jest.fn() };
  const files = { read: jest.fn(async () => bytes), write: jest.fn(), size: jest.fn() };
  await expect(new ImageTransport(store, files).uploadMissingImages(userId, [{ ...entry, localPath: 'file:///local.png' }], [])).rejects.toThrow('offline');
});

test('downloads missing images into the account namespace and checks length', async () => {
  const store = { upload: jest.fn(), download: jest.fn(async () => bytes) };
  const files = { read: jest.fn(), write: jest.fn(async () => 'file:///account/image-1.png'), size: jest.fn(async () => null) };
  const transport = new ImageTransport(store, files);
  const paths = await transport.downloadMissingImages(userId, [entry], new Map());
  expect(files.write).toHaveBeenCalledWith(userId, entry, bytes);
  expect(paths.get('image-1')).toBe('file:///account/image-1.png');
  store.download.mockResolvedValueOnce(new Uint8Array([1]));
  await expect(transport.downloadMissingImages(userId, [entry], new Map())).rejects.toThrow('大小不匹配');
});
