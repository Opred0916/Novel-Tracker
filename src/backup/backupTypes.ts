import type { BookStatus, BookType } from '../books/types';

export const BACKUP_FORMAT_VERSION = 1 as const;
export const CURRENT_BACKUP_FORMAT_VERSION = 2 as const;
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
  startedOn: string;
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
