import { strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { BackupArchive } from '../../src/backup/backupArchive';
import type { BackupChunkWriter, BackupFilePort } from '../../src/backup/backupFilePort';
import type { BackupSnapshot } from '../../src/backup/backupRepository';
import type { BackupErrorCode } from '../../src/backup/backupTypes';
import { BackupValidationError } from '../../src/backup/backupValidation';
import { makeValidManifest } from './backupFixtures';

const concat = (chunks: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
};

class MemoryFilePort implements BackupFilePort {
  readonly files = new Map<string, Uint8Array>();
  diskSpace = 10_000_000;
  maxReadChunkSize = Number.POSITIVE_INFINITY;
  readonly openWriters = new Set<string>();

  put(uri: string, data: Uint8Array): void { this.files.set(uri, data.slice()); }

  async stat(uri: string) {
    const data = this.files.get(uri);
    return { exists: data !== undefined, size: data?.length ?? 0 };
  }

  async *readChunks(uri: string, chunkSize: number): AsyncIterable<Uint8Array> {
    const data = this.files.get(uri);
    if (!data) throw new Error(`missing ${uri}`);
    const effectiveChunkSize = Math.min(chunkSize, this.maxReadChunkSize);
    for (let offset = 0; offset < data.length; offset += effectiveChunkSize) yield data.slice(offset, offset + effectiveChunkSize);
  }

  async openChunkWriter(uri: string): Promise<BackupChunkWriter> {
    const chunks: Uint8Array[] = [];
    this.openWriters.add(uri);
    return {
      write: async chunk => { chunks.push(chunk.slice()); },
      close: async () => { this.files.set(uri, concat(chunks)); this.openWriters.delete(uri); },
    };
  }

  async remove(uri: string): Promise<void> { this.files.delete(uri); }
  async availableDiskSpace(): Promise<number> { return this.diskSpace; }
}

class DisappearingSourcePort extends MemoryFilePort {
  async *readChunks(uri: string, chunkSize: number): AsyncIterable<Uint8Array> {
    this.files.delete(uri);
    yield* super.readChunks(uri, chunkSize);
  }
}

function makeSnapshot(): BackupSnapshot {
  const manifest = makeValidManifest();
  const { images: _images, counts: _counts, formatVersion, exportedAt, appVersion, ...data } = manifest;
  return {
    formatVersion, exportedAt, appVersion, data,
    images: [{
      id: 'image-1', bookId: 'book-1', createdAt: '2026-09-02T01:30:00.000Z', extension: 'jpg',
      localPath: 'memory://source.jpg', archivePath: 'images/image-1.jpg',
    }],
  };
}

async function makeZip(entries: Array<{ name: string; data: Uint8Array; compressed?: boolean }>): Promise<Uint8Array> {
  const output: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    const zip = new Zip((error, data, final) => {
      if (error) reject(error);
      else { output.push(data); if (final) resolve(); }
    });
    for (const entry of entries) {
      const file = entry.compressed === false ? new ZipPassThrough(entry.name) : new ZipDeflate(entry.name);
      zip.add(file);
      file.push(entry.data, true);
    }
    zip.end();
  });
  return concat(output);
}

function expectCode(promise: Promise<unknown>, code: BackupErrorCode): Promise<void> {
  return expect(promise).rejects.toMatchObject<Partial<BackupValidationError>>({ code });
}

describe('BackupArchive', () => {
  test('streams a snapshot round trip with one copy of a shared image', async () => {
    const port = new MemoryFilePort();
    port.put('memory://source.jpg', new Uint8Array([1, 2, 3, 4]));
    const snapshot = makeSnapshot();
    snapshot.images.push({ ...snapshot.images[0] });
    const writeProgress: string[] = [];
    const archive = new BackupArchive(port);

    await archive.write(snapshot, 'memory://backup.noveltracker', progress => writeProgress.push(progress.stage));
    const inspectProgress: string[] = [];
    const inspected = await archive.inspect('memory://backup.noveltracker', 'memory://restore', progress => inspectProgress.push(progress.stage));

    expect(inspected.manifest.images).toEqual([expect.objectContaining({ id: 'image-1', byteLength: 4, archivePath: 'images/image-1.jpg' })]);
    expect(inspected.imagePaths.get('image-1')).toBe('memory://restore/images/image-1.jpg');
    expect([...port.files.keys()].filter(path => path.endsWith('image-1.jpg'))).toHaveLength(1);
    expect(port.files.get('memory://restore/images/image-1.jpg')).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(writeProgress[0]).toBe('packing');
    expect(inspectProgress[0]).toBe('validating');
  });

  test('waits for all decompressed image chunks before checking size and closing writers', async () => {
    const port = new MemoryFilePort();
    port.maxReadChunkSize = 1024;
    const bytes = Uint8Array.from({ length: 600_000 }, (_, index) => index % 251);
    port.put('memory://source.jpg', bytes);
    const archive = new BackupArchive(port);
    await archive.write(makeSnapshot(), 'memory://backup.zip');

    const inspected = await archive.inspect('memory://backup.zip', 'memory://restore');

    expect(port.files.get(inspected.imagePaths.get('image-1')!)).toEqual(bytes);
    expect(port.openWriters.size).toBe(0);
  });

  test('removes an incomplete archive when an image disappears during export', async () => {
    const port = new DisappearingSourcePort();
    port.put('memory://source.jpg', new Uint8Array([1, 2, 3, 4]));

    await expect(new BackupArchive(port).write(makeSnapshot(), 'memory://backup.zip')).rejects.toThrow('missing memory://source.jpg');
    expect(port.files.has('memory://backup.zip')).toBe(false);
    expect(port.openWriters.size).toBe(0);
  });

  test('rejects image payload corruption with an unchanged byte length', async () => {
    const port = new MemoryFilePort();
    const image = new Uint8Array([1, 2, 3, 4]);
    const archiveBytes = await makeZip([
      { name: 'manifest.json', data: strToU8(JSON.stringify(makeValidManifest())) },
      { name: 'images/image-1.jpg', data: image, compressed: false },
    ]);
    const payloadIndex = archiveBytes.findIndex((value, index) => index + image.length <= archiveBytes.length
      && image.every((byte, byteIndex) => archiveBytes[index + byteIndex] === byte));
    expect(payloadIndex).toBeGreaterThanOrEqual(0);
    archiveBytes[payloadIndex] ^= 0xff;
    port.put('memory://corrupt.zip', archiveBytes);

    await expectCode(new BackupArchive(port).inspect('memory://corrupt.zip', 'memory://restore'), 'invalid_file');
  });

  test('rejects an archive truncated before its end-of-central-directory record', async () => {
    const port = new MemoryFilePort();
    const archiveBytes = await makeZip([
      { name: 'manifest.json', data: strToU8(JSON.stringify(makeValidManifest())) },
      { name: 'images/image-1.jpg', data: new Uint8Array([1, 2, 3, 4]), compressed: false },
    ]);
    const eocdIndex = archiveBytes.findIndex((value, index) => value === 0x50 && archiveBytes[index + 1] === 0x4b
      && archiveBytes[index + 2] === 0x05 && archiveBytes[index + 3] === 0x06);
    expect(eocdIndex).toBeGreaterThanOrEqual(0);
    port.put('memory://truncated.zip', archiveBytes.slice(0, eocdIndex));

    await expectCode(new BackupArchive(port).inspect('memory://truncated.zip', 'memory://restore'), 'invalid_file');
  });

  test.each([
    ['../escape.jpg'], ['/absolute.jpg'], ['C:\\escape.jpg'], ['images\\..\\escape.jpg'],
  ])('rejects unsafe ZIP entry %s before extraction', async name => {
    const port = new MemoryFilePort();
    port.put('memory://bad.zip', await makeZip([{ name, data: new Uint8Array([1]) }]));
    await expectCode(new BackupArchive(port).inspect('memory://bad.zip', 'memory://restore'), 'unsafe_path');
    expect([...port.files.keys()].some(path => path.startsWith('memory://restore'))).toBe(false);
  });

  test('rejects duplicate ZIP entry names', async () => {
    const port = new MemoryFilePort();
    port.put('memory://bad.zip', await makeZip([
      { name: 'manifest.json', data: strToU8('{}') },
      { name: 'manifest.json', data: strToU8('{}') },
    ]));
    await expectCode(new BackupArchive(port).inspect('memory://bad.zip', 'memory://restore'), 'unsafe_path');
  });

  test('rejects an undeclared extra file', async () => {
    const port = new MemoryFilePort();
    const manifest = makeValidManifest();
    port.put('memory://bad.zip', await makeZip([
      { name: 'manifest.json', data: strToU8(JSON.stringify(manifest)) },
      { name: 'images/image-1.jpg', data: new Uint8Array([1, 2, 3, 4]), compressed: false },
      { name: 'extra.txt', data: new Uint8Array([5]) },
    ]));
    await expectCode(new BackupArchive(port).inspect('memory://bad.zip', 'memory://restore'), 'invalid_file');
  });

  test('enforces entry, manifest, uncompressed byte, and free-space limits without large allocations', async () => {
    const baseEntries = [
      { name: 'manifest.json', data: strToU8(JSON.stringify(makeValidManifest())) },
      { name: 'images/image-1.jpg', data: new Uint8Array([1, 2, 3, 4]), compressed: false },
    ];

    const entryPort = new MemoryFilePort();
    entryPort.put('memory://entry.zip', await makeZip(baseEntries));
    await expectCode(new BackupArchive(entryPort, { maxEntries: 1 }).inspect('memory://entry.zip', 'memory://restore'), 'archive_too_large');

    const manifestPort = new MemoryFilePort();
    manifestPort.put('memory://manifest.zip', await makeZip(baseEntries));
    await expectCode(new BackupArchive(manifestPort, { maxManifestBytes: 10 }).inspect('memory://manifest.zip', 'memory://restore'), 'archive_too_large');

    const sizePort = new MemoryFilePort();
    sizePort.put('memory://size.zip', await makeZip(baseEntries));
    await expectCode(new BackupArchive(sizePort, { maxUncompressedBytes: 3 }).inspect('memory://size.zip', 'memory://restore'), 'archive_too_large');

    const diskPort = new MemoryFilePort();
    diskPort.diskSpace = 3;
    diskPort.put('memory://disk.zip', await makeZip(baseEntries));
    await expectCode(new BackupArchive(diskPort).inspect('memory://disk.zip', 'memory://restore'), 'storage_insufficient');
  });

  test('rejects image bytes that do not match the manifest declaration', async () => {
    const port = new MemoryFilePort();
    const manifest = makeValidManifest();
    manifest.images[0].byteLength = 99;
    port.put('memory://bad.zip', await makeZip([
      { name: 'manifest.json', data: strToU8(JSON.stringify(manifest)) },
      { name: 'images/image-1.jpg', data: new Uint8Array([1, 2, 3, 4]), compressed: false },
    ]));
    await expectCode(new BackupArchive(port).inspect('memory://bad.zip', 'memory://restore'), 'invalid_file');
  });

  test('reserves room for both extracted images and the replacement image generation', async () => {
    const port = new MemoryFilePort();
    const manifestBytes = strToU8(JSON.stringify(makeValidManifest()));
    port.diskSpace = manifestBytes.length + 7;
    port.put('memory://backup.zip', await makeZip([
      { name: 'manifest.json', data: manifestBytes },
      { name: 'images/image-1.jpg', data: new Uint8Array([1, 2, 3, 4]), compressed: false },
    ]));

    await expectCode(new BackupArchive(port).inspect('memory://backup.zip', 'memory://restore'), 'storage_insufficient');
  });
});
