import type { BackupManifestV1 } from '../../src/backup/backupTypes';

export function makeValidManifest(): BackupManifestV1 {
  return {
    formatVersion: 1,
    exportedAt: '2026-10-02T12:00:00.000Z',
    appVersion: '1.0.0',
    counts: {
      books: 1,
      protagonists: 2,
      tags: 1,
      bookTags: 1,
      quickTags: 1,
      readingSessions: 1,
      notes: 1,
      noteImages: 1,
      highlightImages: 1,
      images: 1,
    },
    books: [{
      id: 'book-1', title: '长夜', author: '某作者', status: 'finished', bookType: 'romance_male_male',
      ratingHalfStars: 9, legacyReadCount: 1, createdAt: '2026-09-01T01:02:03.000Z', updatedAt: '2026-10-02T02:03:04.000Z',
    }],
    protagonists: [
      { bookId: 'book-1', position: 0, name: '阿青' },
      { bookId: 'book-1', position: 1, name: '长庚' },
    ],
    tags: [{ id: 'tag-1', name: '仙侠', isSystem: true }],
    bookTags: [{ bookId: 'book-1', tagId: 'tag-1', position: 0 }],
    quickTags: [{ tagId: 'tag-1', position: 0 }],
    readingSessions: [{
      id: 'session-1', bookId: 'book-1', ordinal: 1, startedOn: '2026-09-01', endedOn: '2026-09-03', outcome: 'finished',
    }],
    notes: [{
      id: 'note-1', bookId: 'book-1', body: '第一次阅读后的想法', createdAt: '2026-09-02T01:00:00.000Z',
      updatedAt: '2026-09-02T02:00:00.000Z', readingSessionId: 'session-1',
    }],
    noteImages: [{ noteId: 'note-1', imageId: 'image-1', position: 0 }],
    highlightImages: [{ bookId: 'book-1', imageId: 'image-1', position: 0 }],
    images: [{
      id: 'image-1', bookId: 'book-1', createdAt: '2026-09-02T01:30:00.000Z', extension: 'jpg',
      byteLength: 4, archivePath: 'images/image-1.jpg',
    }],
  };
}

export function makeEmptyManifest(): BackupManifestV1 {
  return {
    formatVersion: 1,
    exportedAt: '2026-10-02T12:00:00.000Z',
    appVersion: '1.0.0',
    counts: {
      books: 0, protagonists: 0, tags: 0, bookTags: 0, quickTags: 0,
      readingSessions: 0, notes: 0, noteImages: 0, highlightImages: 0, images: 0,
    },
    books: [], protagonists: [], tags: [], bookTags: [], quickTags: [], readingSessions: [], notes: [],
    noteImages: [], highlightImages: [], images: [],
  };
}
