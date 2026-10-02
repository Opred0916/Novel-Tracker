import {
  BackupValidationError,
  countsFromManifest,
  isSafeArchivePath,
  validateBackupManifest,
} from '../../src/backup/backupValidation';
import { makeEmptyManifest, makeValidManifest } from './backupFixtures';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectCode(input: unknown, code: string): void {
  try {
    validateBackupManifest(input);
    throw new Error('expected validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(BackupValidationError);
    expect((error as BackupValidationError).code).toBe(code);
  }
}

describe('backup manifest validation', () => {
  test('accepts a complete version 1 manifest without mutating it', () => {
    const manifest = makeValidManifest();
    const before = clone(manifest);
    expect(validateBackupManifest(manifest)).toEqual(before);
    expect(manifest).toEqual(before);
    expect(countsFromManifest(manifest)).toEqual(manifest.counts);
  });

  test('accepts an empty library', () => {
    expect(validateBackupManifest(makeEmptyManifest())).toEqual(makeEmptyManifest());
  });

  test.each([
    ['non-object wrapper', null, 'invalid_manifest'],
    ['newer version', { ...makeEmptyManifest(), formatVersion: 2 }, 'unsupported_version'],
    ['missing array', (() => { const value: any = clone(makeEmptyManifest()); delete value.notes; return value; })(), 'invalid_manifest'],
    ['empty book title', (() => { const value = makeValidManifest(); value.books[0].title = '  '; return value; })(), 'invalid_value'],
    ['empty note body', (() => { const value = makeValidManifest(); value.notes[0].body = ''; return value; })(), 'invalid_value'],
    ['invalid status', (() => { const value: any = makeValidManifest(); value.books[0].status = 'later'; return value; })(), 'invalid_value'],
    ['invalid book type', (() => { const value: any = makeValidManifest(); value.books[0].bookType = 'mystery'; return value; })(), 'invalid_value'],
    ['invalid rating', (() => { const value = makeValidManifest(); value.books[0].ratingHalfStars = 11; return value; })(), 'invalid_value'],
    ['rating on unfinished book', (() => { const value = makeValidManifest(); value.books[0].status = 'reading'; return value; })(), 'invalid_value'],
    ['invalid date-only value', (() => { const value = makeValidManifest(); value.readingSessions[0].startedOn = '2026-02-30'; return value; })(), 'invalid_value'],
    ['invalid timestamp', (() => { const value = makeValidManifest(); value.notes[0].createdAt = 'yesterday'; return value; })(), 'invalid_value'],
    ['reading session with end date', (() => { const value = makeValidManifest(); value.readingSessions[0].outcome = 'reading'; return value; })(), 'invalid_value'],
    ['finished session without end date', (() => { const value = makeValidManifest(); value.readingSessions[0].endedOn = null; return value; })(), 'invalid_value'],
  ])('rejects %s', (_name, input, code) => {
    expectCode(input, code);
  });

  test.each([
    ['book ids', (value: any) => value.books.push({ ...value.books[0] }), 'duplicate_id'],
    ['tag ids', (value: any) => value.tags.push({ ...value.tags[0] }), 'duplicate_id'],
    ['reading session ids', (value: any) => value.readingSessions.push({ ...value.readingSessions[0] }), 'duplicate_id'],
    ['note ids', (value: any) => value.notes.push({ ...value.notes[0] }), 'duplicate_id'],
    ['image ids', (value: any) => value.images.push({ ...value.images[0], archivePath: 'images/copy.jpg' }), 'duplicate_id'],
  ])('rejects duplicate %s', (_name, mutate, code) => {
    const value: any = makeValidManifest();
    mutate(value);
    expectCode(value, code);
  });

  test.each([
    ['protagonist book', (value: any) => { value.protagonists[0].bookId = 'missing'; }],
    ['book-tag book', (value: any) => { value.bookTags[0].bookId = 'missing'; }],
    ['book-tag tag', (value: any) => { value.bookTags[0].tagId = 'missing'; }],
    ['quick tag', (value: any) => { value.quickTags[0].tagId = 'missing'; }],
    ['reading session book', (value: any) => { value.readingSessions[0].bookId = 'missing'; }],
    ['note book', (value: any) => { value.notes[0].bookId = 'missing'; }],
    ['note reading session', (value: any) => { value.notes[0].readingSessionId = 'missing'; }],
    ['note-image note', (value: any) => { value.noteImages[0].noteId = 'missing'; }],
    ['note-image image', (value: any) => { value.noteImages[0].imageId = 'missing'; }],
    ['highlight book', (value: any) => { value.highlightImages[0].bookId = 'missing'; }],
    ['highlight image', (value: any) => { value.highlightImages[0].imageId = 'missing'; }],
    ['image book', (value: any) => { value.images[0].bookId = 'missing'; }],
  ])('rejects dangling %s reference', (_name, mutate) => {
    const value: any = makeValidManifest();
    mutate(value);
    expectCode(value, 'invalid_reference');
  });

  test('rejects a note linked to another book reading session', () => {
    const value = makeValidManifest();
    value.books.push({ ...value.books[0], id: 'book-2', title: '另一部' });
    value.notes[0].bookId = 'book-2';
    value.counts.books = 2;
    expectCode(value, 'invalid_reference');
  });

  test('rejects mismatched counts', () => {
    const value = makeValidManifest();
    value.counts.notes = 2;
    expectCode(value, 'count_mismatch');
  });

  test('rejects duplicate archive paths', () => {
    const value = makeValidManifest();
    value.images.push({ ...value.images[0], id: 'image-2' });
    value.counts.images = 2;
    expectCode(value, 'unsafe_path');
  });

  test.each([
    '../x', '/x', 'C:\\x', 'images\\..\\x', 'images/../x', './images/x.jpg', 'file:///x', 'images//x.jpg',
  ])('rejects unsafe archive path %s', path => {
    expect(isSafeArchivePath(path)).toBe(false);
    const value = makeValidManifest();
    value.images[0].archivePath = path;
    expectCode(value, 'unsafe_path');
  });

  test('accepts a simple images path', () => {
    expect(isSafeArchivePath('images/image-1.jpg')).toBe(true);
  });
});
