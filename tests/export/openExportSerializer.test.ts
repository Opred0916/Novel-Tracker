import { strFromU8 } from 'fflate';
import type { BackupManifestV4 } from '../../src/backup/backupTypes';
import { createOpenExportFiles } from '../../src/export/openExportSerializer';
import { OPEN_EXPORT_TEXT_NAMES } from '../../src/export/openExportTypes';
import { makeEmptyManifest, makeValidManifest } from '../backup/backupFixtures';

function asV4(manifest = makeValidManifest()): BackupManifestV4 {
  return {
    ...manifest,
    formatVersion: 4,
    books: [{ ...manifest.books[0], coverImageId: 'image-1', whyWantToRead: '朋友推荐', platform: '晋江文学城' }],
    readingSessions: [
      { ...manifest.readingSessions[0], startedOn: null, endedOn: null },
      { id: 'session-2', bookId: 'book-1', ordinal: 2, startedOn: '2026-10-01', endedOn: null, outcome: 'reading' },
    ],
    notes: [{
      ...manifest.notes[0], body: ' =SUM(A1:A2), "引号"\r\n换行 😀', sourceKind: 'import',
      originalRecordedOn: null, originalRecordedTime: null,
    }],
  };
}

test('creates complete open export text files without leaking local paths', () => {
  const files = createOpenExportFiles(asV4());
  expect(Object.keys(files)).toEqual([...OPEN_EXPORT_TEXT_NAMES]);

  const document = JSON.parse(strFromU8(files['library.json'])) as Record<string, unknown>;
  expect(document).toMatchObject({ exportFormat: 'novel-tracker-open', formatVersion: 2, appVersion: '1.0.0' });
  expect((document.books as Array<Record<string, unknown>>)[0]).toMatchObject({ coverImageId: 'image-1', title: '长夜', whyWantToRead: '朋友推荐', platform: '晋江文学城' });
  expect((document.readingSessions as Array<Record<string, unknown>>)[0]).toMatchObject({ startedOn: null, endedOn: null });
  expect((document.notes as Array<Record<string, unknown>>)[0]).toMatchObject({ sourceKind: 'import', originalRecordedOn: null });
  expect(JSON.stringify(document)).not.toContain('localPath');
  expect(strFromU8(files['README.txt'])).toContain('开放格式导出不可直接恢复');
});

test('serializes CSV with readable columns, escaped multiline text, and formula protection', () => {
  const files = createOpenExportFiles(asV4());
  const books = strFromU8(files['books.csv']);
  const notes = strFromU8(files['notes.csv']);

  expect([...files['books.csv'].slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(books).toContain('book_id,title,author,status,book_type,rating_half_stars,protagonists,tags,cover_path,why_want_to_read,platform,created_at,updated_at\r\n');
  expect(books).toContain('book-1,长夜,某作者,finished,romance_male_male,4.5,阿青; 长庚,仙侠,images/image-1.jpg,朋友推荐,晋江文学城');
  expect(notes).toContain('note_id,book_id,book_title,body,reading_session_id,original_recorded_on,original_recorded_time,source_kind,created_at,updated_at,note_image_ids\r\n');
  expect(notes).toContain('note-1,book-1,长夜,"\' =SUM(A1:A2), ""引号""\r\n换行 😀",session-1,,,import');
});

test('creates valid empty export tables with headers only', () => {
  const files = createOpenExportFiles({ ...makeEmptyManifest(), formatVersion: 4, books: [], images: [] } as BackupManifestV4);
  expect([...files['books.csv'].slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(strFromU8(files['books.csv'])).toBe('book_id,title,author,status,book_type,rating_half_stars,protagonists,tags,cover_path,why_want_to_read,platform,created_at,updated_at\r\n');
  expect(strFromU8(files['reading-history.csv'])).toContain('session_id,book_id,book_title,ordinal,outcome,started_on,ended_on\r\n');
  expect(strFromU8(files['notes.csv'])).toContain('note_id,book_id,book_title,body,reading_session_id,original_recorded_on,original_recorded_time,source_kind,created_at,updated_at,note_image_ids\r\n');
  expect(strFromU8(files['images.csv'])).toContain('image_id,book_id,relative_path,extension,byte_length,created_at,usages,note_ids\r\n');
});
