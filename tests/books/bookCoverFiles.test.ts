import { BookCoverFiles, MAX_COVER_BYTES } from '../../src/books/bookCoverFiles';

function fakeFileSystem() {
  const files = new Map<string, { size: number }>();
  return {
    documentDirectory: 'file:///documents/',
    cacheDirectory: 'file:///cache/',
    makeDirectoryAsync: jest.fn(async () => undefined),
    copyAsync: jest.fn(async ({ to }: { from: string; to: string }) => { files.set(to, { size: 100 }); }),
    writeAsStringAsync: jest.fn(async (uri: string, value: string) => { files.set(uri, { size: value.length }); }),
    deleteAsync: jest.fn(async (uri: string) => { files.delete(uri); }),
    getInfoAsync: jest.fn(async (uri: string) => ({ exists: files.has(uri), size: files.get(uri)?.size })),
  };
}

function response(options: { status?: number; body?: Uint8Array; type?: string; url?: string } = {}) {
  const body = options.body ?? new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  return {
    ok: (options.status ?? 200) >= 200 && (options.status ?? 200) < 300,
    status: options.status ?? 200,
    url: options.url ?? 'https://example.com/cover.png',
    headers: { get: (name: string) => name === 'content-type' ? (options.type ?? 'image/png') : null },
    arrayBuffer: async () => body.buffer as ArrayBuffer,
  };
}

const fetchMock = jest.fn(async () => response());

beforeEach(() => fetchMock.mockClear());

test('stages a picked image in cache and rejects an oversized file', async () => {
  const fs = fakeFileSystem();
  const files = new BookCoverFiles(fs, () => 'stage-1', fetchMock, async () => undefined);
  const staged = await files.stageFromPicker('ph://photo.jpeg');
  expect(staged).toEqual({ uri: 'file:///cache/novel-tracker/staging/stage-1.jpeg', extension: 'jpeg' });
  expect(fs.copyAsync).toHaveBeenCalledWith({ from: 'ph://photo.jpeg', to: staged.uri });

  fs.getInfoAsync.mockResolvedValueOnce({ exists: true, size: MAX_COVER_BYTES + 1 });
  await expect(files.stageFromPicker('ph://too-large.jpg')).rejects.toThrow('10 MB');
});

test('downloads HTTPS image bytes and rejects insecure or non-image URLs', async () => {
  const fs = fakeFileSystem();
  const files = new BookCoverFiles(fs, () => 'stage-2', fetchMock, async () => undefined);
  const staged = await files.stageFromUrl('https://example.com/cover.png');
  expect(staged.extension).toBe('png');
  expect(fs.writeAsStringAsync).toHaveBeenCalled();
  await expect(files.stageFromUrl('http://example.com/cover.png')).rejects.toThrow('HTTPS');
  fetchMock.mockResolvedValueOnce(response({ type: 'text/html' }));
  await expect(files.stageFromUrl('https://example.com/page')).rejects.toThrow('图片格式');
});

test('follows only HTTPS redirects and limits redirect count', async () => {
  const fs = fakeFileSystem();
  const files = new BookCoverFiles(fs, () => 'stage-3', fetchMock, async () => undefined);
  fetchMock
    .mockResolvedValueOnce({ ...response({ status: 302 }), headers: { get: () => 'https://cdn.example.com/cover.jpg' } })
    .mockResolvedValueOnce(response({ type: 'image/jpeg', body: new Uint8Array([0xff, 0xd8, 0xff]), url: 'https://cdn.example.com/cover.jpg' }));
  expect((await files.stageFromUrl('https://example.com/redirect')).extension).toBe('jpg');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
