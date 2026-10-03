import { strFromU8, unzipSync } from 'fflate';
import { BackupValidationError } from '../../src/backup/backupValidation';
import type { BackupChunkWriter, BackupFilePort } from '../../src/backup/backupFilePort';
import type { BackupSnapshot } from '../../src/backup/backupRepository';
import { OpenExportArchive } from '../../src/export/openExportArchive';
import { createOpenExportFiles } from '../../src/export/openExportSerializer';
import { makeValidManifest } from '../backup/backupFixtures';

const concat = (chunks: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
};

class MemoryFilePort implements BackupFilePort {
  readonly files = new Map<string, Uint8Array>();
  diskSpace = 10_000_000;
  readOverride: ((uri: string, data: Uint8Array) => Uint8Array) | null = null;

  put(uri: string, data: Uint8Array): void { this.files.set(uri, data.slice()); }
  async stat(uri: string) { const data = this.files.get(uri); return { exists: data !== undefined, size: data?.length ?? 0 }; }
  async *readChunks(uri: string, chunkSize: number): AsyncIterable<Uint8Array> {
    const stored = this.files.get(uri);
    if (!stored) throw new Error(`missing ${uri}`);
    const data = this.readOverride ? this.readOverride(uri, stored.slice()) : stored;
    for (let offset = 0; offset < data.length; offset += chunkSize) yield data.slice(offset, offset + chunkSize);
  }
  async openChunkWriter(uri: string): Promise<BackupChunkWriter> {
    const chunks: Uint8Array[] = [];
    return { write: async chunk => { chunks.push(chunk.slice()); }, close: async () => { this.files.set(uri, concat(chunks)); } };
  }
  async remove(uri: string): Promise<void> { this.files.delete(uri); }
  async availableDiskSpace(): Promise<number> { return this.diskSpace; }
}

function makeSnapshot(): BackupSnapshot {
  const manifest = makeValidManifest();
  const data = {
    books: [{ ...manifest.books[0], coverImageId: 'image-1' }], protagonists: manifest.protagonists, tags: manifest.tags,
    bookTags: manifest.bookTags, quickTags: manifest.quickTags,
    readingSessions: [{ ...manifest.readingSessions[0], startedOn: null, endedOn: null }],
    notes: [{ ...manifest.notes[0], sourceKind: 'import' as const, originalRecordedOn: null, originalRecordedTime: null }],
    noteImages: manifest.noteImages, highlightImages: manifest.highlightImages,
  };
  return {
    formatVersion: 3, exportedAt: manifest.exportedAt, appVersion: manifest.appVersion, data,
    images: [{ id: 'image-1', bookId: 'book-1', createdAt: '2026-09-02T01:30:00.000Z', extension: 'jpg', localPath: 'memory://source.jpg', archivePath: 'images/image-1.jpg' }],
  };
}

test('writes one standard ZIP with text files and one copy of a shared image', async () => {
  const port = new MemoryFilePort();
  port.put('memory://source.jpg', new Uint8Array([1, 2, 3, 4]));
  const archive = new OpenExportArchive(port);

  await archive.write(makeSnapshot(), 'memory://export.zip');

  const entries = unzipSync(port.files.get('memory://export.zip')!);
  expect(Object.keys(entries).sort()).toEqual(['README.txt', 'books.csv', 'images.csv', 'images/image-1.jpg', 'library.json', 'notes.csv', 'reading-history.csv'].sort());
  expect(entries['images/image-1.jpg']).toEqual(new Uint8Array([1, 2, 3, 4]));
  expect(strFromU8(entries['library.json'])).toContain('"exportFormat": "novel-tracker-open"');
});

test('rejects duplicate image IDs and missing images', async () => {
  const port = new MemoryFilePort();
  port.put('memory://source.jpg', new Uint8Array([1, 2, 3, 4]));
  const snapshot = makeSnapshot();
  snapshot.images.push({ ...snapshot.images[0] });
  await expect(new OpenExportArchive(port).write(snapshot, 'memory://export.zip')).rejects.toMatchObject({ code: 'duplicate_id' });
  expect(port.files.has('memory://export.zip')).toBe(false);

  const missing = makeSnapshot();
  missing.images[0].localPath = 'memory://missing-source.jpg';
  await expect(new OpenExportArchive(port).write(missing, 'memory://missing.zip')).rejects.toMatchObject<Partial<BackupValidationError>>({ code: 'image_missing' });
  expect(port.files.has('memory://missing.zip')).toBe(false);
});

test('rejects an image whose bytes change after the preflight stat', async () => {
  const port = new MemoryFilePort();
  port.put('memory://source.jpg', new Uint8Array([1, 2, 3, 4]));
  port.readOverride = () => new Uint8Array([1, 2, 3]);
  await expect(new OpenExportArchive(port).write(makeSnapshot(), 'memory://changed.zip')).rejects.toMatchObject({ code: 'export_failed' });
  expect(port.files.has('memory://changed.zip')).toBe(false);
});

test('enforces injected image, JSON, total-size, and disk limits', async () => {
  const port = new MemoryFilePort();
  port.put('memory://source.jpg', new Uint8Array([1, 2, 3, 4]));
  const snapshot = makeSnapshot();
  await expect(new OpenExportArchive(port, { maxImages: 0 }).write(snapshot, 'memory://images-limit.zip')).rejects.toMatchObject({ code: 'archive_too_large' });
  await expect(new OpenExportArchive(port, { maxJsonBytes: 1 }).write(snapshot, 'memory://json-limit.zip')).rejects.toMatchObject({ code: 'archive_too_large' });
  await expect(new OpenExportArchive(port, { maxUncompressedBytes: 1 }).write(snapshot, 'memory://total-limit.zip')).rejects.toMatchObject({ code: 'archive_too_large' });
  port.diskSpace = 1;
  await expect(new OpenExportArchive(port).write(snapshot, 'memory://disk-limit.zip')).rejects.toMatchObject({ code: 'storage_insufficient' });
});
