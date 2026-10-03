import type { BackupCounts, BackupDataCollections, BackupImageEntry, BackupManifestV4 } from '../backup/backupTypes';

export const OPEN_EXPORT_FORMAT = 'novel-tracker-open' as const;
export const OPEN_EXPORT_FORMAT_VERSION = 2 as const;
export const OPEN_EXPORT_TEXT_NAMES = [
  'README.txt', 'library.json', 'books.csv', 'reading-history.csv', 'notes.csv', 'images.csv',
] as const;

export type OpenExportTextName = (typeof OPEN_EXPORT_TEXT_NAMES)[number];
export type OpenExportDocument = {
  exportFormat: typeof OPEN_EXPORT_FORMAT;
  formatVersion: typeof OPEN_EXPORT_FORMAT_VERSION;
  exportedAt: string;
  appVersion: string;
  counts: BackupCounts;
} & BackupDataCollections & { images: BackupImageEntry[] };

export type OpenExportFiles = Record<OpenExportTextName, Uint8Array>;
export type OpenExportProgress = {
  stage: 'collecting' | 'checking_images' | 'packing';
  processedBytes?: number;
  totalBytes?: number;
};

export type OpenExportManifest = BackupManifestV4;
