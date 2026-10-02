import { BOOK_STATUSES, BOOK_TYPES, type BookType } from '../books/types';
import {
  BACKUP_FORMAT_VERSION,
  CURRENT_BACKUP_FORMAT_VERSION,
  type BackupCounts,
  type BackupErrorCode,
  type BackupManifestV1,
} from './backupTypes';

export class BackupValidationError extends Error {
  constructor(public readonly code: BackupErrorCode, message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function fail(code: BackupErrorCode, message: string): never {
  throw new BackupValidationError(code, message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('invalid_manifest', `${label} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail('invalid_manifest', `${label} must be an array`);
  return value;
}

function string(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) fail('invalid_value', `${label} is invalid`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label);
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (!Number.isInteger(value) || (value as number) < minimum) fail('invalid_value', `${label} is invalid`);
  return value as number;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail('invalid_value', `${label} is invalid`);
  return value;
}

function timestamp(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(parsed) || Number.isNaN(Date.parse(parsed))) {
    fail('invalid_value', `${label} is invalid`);
  }
  return parsed;
}

function dateOnly(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) fail('invalid_value', `${label} is invalid`);
  const [year, month, day] = parsed.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    fail('invalid_value', `${label} is invalid`);
  }
  return parsed;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) fail('invalid_value', `${label} is invalid`);
  return value as T;
}

function optionalNullableBookType(value: unknown, label: string): BookType | null {
  return value === null ? null : enumValue(value, BOOK_TYPES, label);
}

function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) fail('duplicate_id', `${label} contains duplicates`);
}

function uniqueKeys(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) fail('duplicate_id', `${label} contains duplicates`);
}

function requireReference(ids: ReadonlySet<string>, value: string, label: string): void {
  if (!ids.has(value)) fail('invalid_reference', `${label} does not exist`);
}

export function isSafeArchivePath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0 || path.includes('%') || path.includes('\\') || path.includes('//')) return false;
  if (path.startsWith('/') || path.startsWith('./') || /^[A-Za-z]:/.test(path) || /^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  const parts = path.split('/');
  return parts.length === 2 && parts[0] === 'images' && parts[1].length > 0 && parts.every(part => part !== '.' && part !== '..');
}

export function countsFromManifest(manifest: BackupManifestV1): BackupCounts {
  return {
    books: manifest.books.length,
    protagonists: manifest.protagonists.length,
    tags: manifest.tags.length,
    bookTags: manifest.bookTags.length,
    quickTags: manifest.quickTags.length,
    readingSessions: manifest.readingSessions.length,
    notes: manifest.notes.length,
    noteImages: manifest.noteImages.length,
    highlightImages: manifest.highlightImages.length,
    images: manifest.images.length,
  };
}

export function validateBackupManifest(input: unknown): BackupManifestV1 {
  const root = record(input, 'manifest');
  const formatVersion = root.formatVersion;
  if (formatVersion !== BACKUP_FORMAT_VERSION && formatVersion !== CURRENT_BACKUP_FORMAT_VERSION) {
    if (typeof formatVersion === 'number' && formatVersion > CURRENT_BACKUP_FORMAT_VERSION) fail('unsupported_version', 'backup is newer than this app');
    fail('invalid_manifest', 'formatVersion is invalid');
  }

  timestamp(root.exportedAt, 'exportedAt');
  string(root.appVersion, 'appVersion');
  const counts = record(root.counts, 'counts');
  const collectionNames = ['books', 'protagonists', 'tags', 'bookTags', 'quickTags', 'readingSessions', 'notes', 'noteImages', 'highlightImages', 'images'] as const;
  for (const name of collectionNames) {
    integer(counts[name], `counts.${name}`);
    array(root[name], name);
  }

  const books = root.books as unknown[];
  const protagonists = root.protagonists as unknown[];
  const tags = root.tags as unknown[];
  const bookTags = root.bookTags as unknown[];
  const quickTags = root.quickTags as unknown[];
  const readingSessions = root.readingSessions as unknown[];
  const notes = root.notes as unknown[];
  const noteImages = root.noteImages as unknown[];
  const highlightImages = root.highlightImages as unknown[];
  const images = root.images as unknown[];

  for (const [index, value] of books.entries()) {
    const item = record(value, `books[${index}]`);
    string(item.id, 'book.id'); string(item.title, 'book.title'); nullableString(item.author, 'book.author');
    enumValue(item.status, BOOK_STATUSES, 'book.status');
    optionalNullableBookType(item.bookType, 'book.bookType');
    if (item.ratingHalfStars !== null) {
      const rating = integer(item.ratingHalfStars, 'book.ratingHalfStars', 1);
      if (rating > 10) fail('invalid_value', 'book.ratingHalfStars is invalid');
    }
    const legacyReadCount = integer(item.legacyReadCount, 'book.legacyReadCount');
    if (legacyReadCount > 1) fail('invalid_value', 'book.legacyReadCount is invalid');
    timestamp(item.createdAt, 'book.createdAt'); timestamp(item.updatedAt, 'book.updatedAt');
    if (formatVersion === CURRENT_BACKUP_FORMAT_VERSION) {
      if (!Object.prototype.hasOwnProperty.call(item, 'coverImageId')) fail('invalid_value', 'book.coverImageId is required in format v2');
      if (item.coverImageId !== null) string(item.coverImageId, 'book.coverImageId');
    }
  }
  for (const [index, value] of protagonists.entries()) {
    const item = record(value, `protagonists[${index}]`);
    string(item.bookId, 'protagonist.bookId'); integer(item.position, 'protagonist.position'); string(item.name, 'protagonist.name');
  }
  for (const [index, value] of tags.entries()) {
    const item = record(value, `tags[${index}]`);
    string(item.id, 'tag.id'); string(item.name, 'tag.name'); boolean(item.isSystem, 'tag.isSystem');
  }
  for (const [index, value] of bookTags.entries()) {
    const item = record(value, `bookTags[${index}]`);
    string(item.bookId, 'bookTag.bookId'); string(item.tagId, 'bookTag.tagId'); integer(item.position, 'bookTag.position');
  }
  for (const [index, value] of quickTags.entries()) {
    const item = record(value, `quickTags[${index}]`);
    string(item.tagId, 'quickTag.tagId'); integer(item.position, 'quickTag.position');
  }
  for (const [index, value] of readingSessions.entries()) {
    const item = record(value, `readingSessions[${index}]`);
    string(item.id, 'readingSession.id'); string(item.bookId, 'readingSession.bookId'); integer(item.ordinal, 'readingSession.ordinal', 1);
    dateOnly(item.startedOn, 'readingSession.startedOn');
    const outcome = enumValue(item.outcome, ['reading', 'finished', 'dropped'] as const, 'readingSession.outcome');
    if (outcome === 'reading') {
      if (item.endedOn !== null) fail('invalid_value', 'active reading session cannot have an end date');
    } else {
      const endedOn = dateOnly(item.endedOn, 'readingSession.endedOn');
      if (endedOn < (item.startedOn as string)) fail('invalid_value', 'reading session ends before it starts');
    }
  }
  for (const [index, value] of notes.entries()) {
    const item = record(value, `notes[${index}]`);
    string(item.id, 'note.id'); string(item.bookId, 'note.bookId'); string(item.body, 'note.body');
    timestamp(item.createdAt, 'note.createdAt'); timestamp(item.updatedAt, 'note.updatedAt');
    if (item.readingSessionId !== null) string(item.readingSessionId, 'note.readingSessionId');
  }
  for (const [index, value] of noteImages.entries()) {
    const item = record(value, `noteImages[${index}]`);
    string(item.noteId, 'noteImage.noteId'); string(item.imageId, 'noteImage.imageId'); integer(item.position, 'noteImage.position');
  }
  for (const [index, value] of highlightImages.entries()) {
    const item = record(value, `highlightImages[${index}]`);
    string(item.bookId, 'highlightImage.bookId'); string(item.imageId, 'highlightImage.imageId'); integer(item.position, 'highlightImage.position');
  }
  for (const [index, value] of images.entries()) {
    const item = record(value, `images[${index}]`);
    string(item.id, 'image.id'); string(item.bookId, 'image.bookId'); timestamp(item.createdAt, 'image.createdAt');
    const extension = string(item.extension, 'image.extension');
    if (!/^[A-Za-z0-9]{1,10}$/.test(extension)) fail('invalid_value', 'image.extension is invalid');
    integer(item.byteLength, 'image.byteLength'); string(item.archivePath, 'image.archivePath');
  }

  const bookIds = new Set(books.map(value => (value as Record<string, unknown>).id as string));
  const tagIds = new Set(tags.map(value => (value as Record<string, unknown>).id as string));
  const sessionIds = new Set(readingSessions.map(value => (value as Record<string, unknown>).id as string));
  const noteIds = new Set(notes.map(value => (value as Record<string, unknown>).id as string));
  const imageIds = new Set(images.map(value => (value as Record<string, unknown>).id as string));
  unique(books.map(value => (value as Record<string, unknown>).id as string), 'book ids');
  unique(tags.map(value => (value as Record<string, unknown>).id as string), 'tag ids');
  unique(readingSessions.map(value => (value as Record<string, unknown>).id as string), 'reading session ids');
  unique(notes.map(value => (value as Record<string, unknown>).id as string), 'note ids');
  unique(images.map(value => (value as Record<string, unknown>).id as string), 'image ids');
  uniqueKeys(protagonists.map(value => `${(value as any).bookId}\0${(value as any).position}`), 'protagonists');
  uniqueKeys(bookTags.map(value => `${(value as any).bookId}\0${(value as any).tagId}`), 'book tags');
  uniqueKeys(quickTags.map(value => (value as any).tagId), 'quick tags');
  uniqueKeys(noteImages.map(value => `${(value as any).noteId}\0${(value as any).imageId}`), 'note images');
  uniqueKeys(highlightImages.map(value => `${(value as any).bookId}\0${(value as any).imageId}`), 'highlight images');

  for (const value of protagonists) requireReference(bookIds, (value as any).bookId, 'protagonist book');
  for (const value of bookTags) { requireReference(bookIds, (value as any).bookId, 'book tag book'); requireReference(tagIds, (value as any).tagId, 'book tag tag'); }
  for (const value of quickTags) requireReference(tagIds, (value as any).tagId, 'quick tag');
  for (const value of readingSessions) requireReference(bookIds, (value as any).bookId, 'reading session book');
  const sessionsById = new Map(readingSessions.map(value => [(value as any).id, value as any]));
  for (const value of notes) {
    const item = value as any;
    requireReference(bookIds, item.bookId, 'note book');
    if (item.readingSessionId !== null) {
      requireReference(sessionIds, item.readingSessionId, 'note reading session');
      if (sessionsById.get(item.readingSessionId).bookId !== item.bookId) fail('invalid_reference', 'note and reading session belong to different books');
    }
  }
  for (const value of images) requireReference(bookIds, (value as any).bookId, 'image book');
  if (formatVersion === CURRENT_BACKUP_FORMAT_VERSION) {
    const imageById = new Map(images.map(value => [(value as any).id as string, value as any]));
    for (const book of books) {
      const coverImageId = (book as any).coverImageId as string | null;
      if (coverImageId !== null) {
        requireReference(imageIds, coverImageId, 'book cover image');
        if (imageById.get(coverImageId).bookId !== (book as any).id) fail('invalid_reference', 'book cover image belongs to another book');
      }
    }
  }
  for (const value of noteImages) { requireReference(noteIds, (value as any).noteId, 'note image note'); requireReference(imageIds, (value as any).imageId, 'note image image'); }
  for (const value of highlightImages) { requireReference(bookIds, (value as any).bookId, 'highlight image book'); requireReference(imageIds, (value as any).imageId, 'highlight image image'); }

  const manifest = root as unknown as BackupManifestV1;
  const actualCounts = countsFromManifest(manifest);
  for (const name of collectionNames) if (counts[name] !== actualCounts[name]) fail('count_mismatch', `${name} count does not match`);

  const archivePaths = images.map(value => (value as any).archivePath as string);
  if (new Set(archivePaths).size !== archivePaths.length) fail('unsafe_path', 'image archive paths must be unique');
  for (const path of archivePaths) if (!isSafeArchivePath(path)) fail('unsafe_path', `unsafe archive path: ${path}`);

  return manifest;
}
