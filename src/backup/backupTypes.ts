import type { BookStatus, BookType } from '../books/types';

export const BACKUP_FORMAT_VERSION = 1 as const;
export const CURRENT_BACKUP_FORMAT_VERSION = 3 as const;
export const MAX_ARCHIVE_ENTRIES = 20_001;
export const MAX_MANIFEST_BYTES = 10 * 1024 * 1024;
export const MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;

export type BackupBook = {
  id: string;
  title: string;
  author: string | null;
  status: BookStatus;
  bookType: BookType | null;
  ratingHalfStars: number | null;
  legacyReadCount: number;
  createdAt: string;
  updatedAt: string;
  /** Present in format v2; absent in v1 and normalized to null on restore. */
  coverImageId?: string | null;
};

export type BackupProtagonist = { bookId: string; position: number; name: string };
export type BackupTag = { id: string; name: string; isSystem: boolean };
export type BackupBookTag = { bookId: string; tagId: string; position: number };
export type BackupQuickTag = { tagId: string; position: number };
export type BackupReadingSession = {
  id: string;
  bookId: string;
  ordinal: number;
  /** Null when an imported historical record did not include the date. */
  startedOn: string | null;
  endedOn: string | null;
  outcome: Exclude<BookStatus, 'want_to_read'>;
};
export type BackupNote = {
  id: string;
  bookId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  readingSessionId: string | null;
  /** Present in format v3; omitted in v1/v2 and restored as app-created. */
  sourceKind?: 'app' | 'import';
  originalRecordedOn?: string | null;
  originalRecordedTime?: string | null;
};
export type BackupNoteImage = { noteId: string; imageId: string; position: number };
export type BackupHighlightImage = { bookId: string; imageId: string; position: number };
export type BackupImageEntry = {
  id: string;
  bookId: string;
  createdAt: string;
  extension: string;
  byteLength: number;
  archivePath: string;
};

export type BackupDataCollections = {
  books: BackupBook[];
  protagonists: BackupProtagonist[];
  tags: BackupTag[];
  bookTags: BackupBookTag[];
  quickTags: BackupQuickTag[];
  readingSessions: BackupReadingSession[];
  notes: BackupNote[];
  noteImages: BackupNoteImage[];
  highlightImages: BackupHighlightImage[];
};

export type BackupCounts = {
  books: number;
  protagonists: number;
  tags: number;
  bookTags: number;
  quickTags: number;
  readingSessions: number;
  notes: number;
  noteImages: number;
  highlightImages: number;
  images: number;
};

export type BackupManifestV1 = BackupDataCollections & {
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  appVersion: string;
  counts: BackupCounts;
  images: BackupImageEntry[];
};

export type BackupManifestV2 = Omit<BackupManifestV1, 'formatVersion'> & {
  formatVersion: 2;
  books: (BackupBook & { coverImageId: string | null })[];
};

export type BackupManifestV3 = Omit<BackupManifestV1, 'formatVersion' | 'books'> & {
  formatVersion: typeof CURRENT_BACKUP_FORMAT_VERSION;
  books: (BackupBook & { coverImageId: string | null })[];
};

export type BackupProgressStage = 'collecting' | 'packing' | 'validating' | 'staging' | 'restoring' | 'cleaning';

export type BackupErrorCode =
  | 'invalid_file'
  | 'unsupported_version'
  | 'invalid_manifest'
  | 'invalid_value'
  | 'duplicate_id'
  | 'invalid_reference'
  | 'count_mismatch'
  | 'unsafe_path'
  | 'archive_too_large'
  | 'storage_insufficient'
  | 'image_missing'
  | 'export_failed'
  | 'restore_failed'
  | 'busy';
