import { countsFromManifest } from '../../src/backup/backupValidation';
import type { BackupBook, BackupManifestV4, BackupNote } from '../../src/backup/backupTypes';
import { conflictChoiceKey, mergeManifests } from '../../src/sync/merge';

const now = '2026-10-10T00:00:00.000Z';

function empty(): BackupManifestV4 {
  const manifest: BackupManifestV4 = {
    formatVersion: 4, exportedAt: now, appVersion: '1.0.0',
    counts: { books: 0, protagonists: 0, tags: 0, bookTags: 0, quickTags: 0, readingSessions: 0, notes: 0, noteImages: 0, highlightImages: 0, images: 0 },
    books: [], protagonists: [], tags: [], bookTags: [], quickTags: [], readingSessions: [], notes: [], noteImages: [], highlightImages: [], images: [],
  };
  return manifest;
}

function book(id: string, title = id): BackupBook & { coverImageId: null; whyWantToRead: null; platform: null } {
  return { id, title, author: null, status: 'want_to_read', bookType: null, ratingHalfStars: null, legacyReadCount: 0, createdAt: now, updatedAt: now, coverImageId: null, whyWantToRead: null, platform: null };
}

function note(id: string, bookId: string, body: string): BackupNote {
  return { id, bookId, body, createdAt: now, updatedAt: now, readingSessionId: null, sourceKind: 'app', originalRecordedOn: null, originalRecordedTime: null };
}

function withCounts(manifest: BackupManifestV4): BackupManifestV4 {
  return { ...manifest, counts: countsFromManifest(manifest) };
}

test('independent offline book additions both survive', () => {
  const base = empty();
  const local = withCounts({ ...empty(), books: [book('a')] });
  const remote = withCounts({ ...empty(), books: [book('b')] });
  const result = mergeManifests(base, local, remote);
  expect(result.conflicts).toEqual([]);
  expect(result.manifest?.books.map(item => item.id)).toEqual(['a', 'b']);
  expect(result.manifest?.counts.books).toBe(2);
});

test('concurrent edits to one note remain unresolved, not overwritten', () => {
  const base = withCounts({ ...empty(), books: [book('a')], notes: [note('n', 'a', 'original')] });
  const local = withCounts({ ...base, notes: [note('n', 'a', 'local')] });
  const remote = withCounts({ ...base, notes: [note('n', 'a', 'remote')] });
  const result = mergeManifests(base, local, remote);
  expect(result.manifest).toBeNull();
  expect(result.conflicts).toMatchObject([{ collection: 'notes', key: 'n', local: { body: 'local' }, remote: { body: 'remote' } }]);
  const decision = mergeManifests(base, local, remote, { [conflictChoiceKey(result.conflicts[0])]: 'local' });
  expect(decision.conflicts).toEqual([]);
  expect(decision.manifest?.notes[0].body).toBe('local');
});

test('edit against deletion requires a decision', () => {
  const base = withCounts({ ...empty(), books: [book('a')] });
  const local = withCounts({ ...base, books: [] });
  const remote = withCounts({ ...base, books: [book('a', 'new title')] });
  const result = mergeManifests(base, local, remote);
  expect(result.manifest).toBeNull();
  expect(result.conflicts[0]).toMatchObject({ collection: 'books', key: 'a', local: null, remote: { title: 'new title' } });
});

test('deleting a book while another device adds a note is a structural conflict', () => {
  const base = withCounts({ ...empty(), books: [book('a')] });
  const local = withCounts({ ...base, books: [] });
  const remote = withCounts({ ...base, notes: [note('n', 'a', 'hi')] });
  const result = mergeManifests(base, local, remote);
  expect(result.manifest).toBeNull();
  expect(result.conflicts.some(conflict => conflict.collection === 'structure')).toBe(true);
});

test('same ordinal on distinct reading session IDs is a structural conflict', () => {
  const base = withCounts({ ...empty(), books: [book('a')] });
  const local = withCounts({ ...base, readingSessions: [{ id: 's1', bookId: 'a', ordinal: 1, startedOn: null, endedOn: null, outcome: 'reading' }] });
  const remote = withCounts({ ...base, readingSessions: [{ id: 's2', bookId: 'a', ordinal: 1, startedOn: null, endedOn: null, outcome: 'reading' }] });
  const result = mergeManifests(base, local, remote);
  expect(result.manifest).toBeNull();
  expect(result.conflicts.some(conflict => conflict.collection === 'structure')).toBe(true);
});
