import { countsFromManifest, validateBackupManifest } from '../backup/backupValidation';
import type { BackupManifestV4 } from '../backup/backupTypes';

const COLLECTIONS = [
  'books', 'protagonists', 'tags', 'bookTags', 'quickTags', 'readingSessions', 'notes', 'noteImages', 'highlightImages', 'images',
] as const;
export type SyncCollection = typeof COLLECTIONS[number];
export type SyncConflict = { collection: SyncCollection | 'structure'; key: string; local: unknown | null; remote: unknown | null; reason?: string };
export type MergeResult = { manifest: BackupManifestV4 | null; conflicts: SyncConflict[] };
export type ConflictChoices = Record<string, 'local' | 'remote'>;
export function conflictChoiceKey(conflict: Pick<SyncConflict, 'collection' | 'key'>): string { return `${conflict.collection}:${conflict.key}`; }

export function sameManifestContent(left: BackupManifestV4, right: BackupManifestV4): boolean {
  return COLLECTIONS.every(collection => normalized(left[collection]) === normalized(right[collection]));
}

function keyFor(collection: SyncCollection, value: Record<string, unknown>): string {
  switch (collection) {
    case 'books': case 'tags': case 'readingSessions': case 'notes': case 'images': return String(value.id);
    case 'protagonists': return `${value.bookId}\0${value.position}`;
    case 'bookTags': return `${value.bookId}\0${value.tagId}`;
    case 'quickTags': return String(value.tagId);
    case 'noteImages': return `${value.noteId}\0${value.imageId}`;
    case 'highlightImages': return `${value.bookId}\0${value.imageId}`;
  }
}

function normalized(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(normalized).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${normalized(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function same(a: unknown, b: unknown): boolean { return normalized(a) === normalized(b); }

function mergeCollection(collection: SyncCollection, base: BackupManifestV4, local: BackupManifestV4, remote: BackupManifestV4, conflicts: SyncConflict[], choices: ConflictChoices): unknown[] {
  const map = (manifest: BackupManifestV4) => new Map((manifest[collection] as Record<string, unknown>[]).map(value => [keyFor(collection, value), value]));
  const before = map(base);
  const here = map(local);
  const there = map(remote);
  const keys = [...new Set([...before.keys(), ...here.keys(), ...there.keys()])].sort();
  const merged: unknown[] = [];
  for (const key of keys) {
    const original = before.get(key);
    const mine = here.get(key);
    const theirs = there.get(key);
    const localChanged = !same(mine, original);
    const remoteChanged = !same(theirs, original);
    if (localChanged && remoteChanged && !same(mine, theirs)) {
      const choice = choices[conflictChoiceKey({ collection, key })];
      if (!choice) { conflicts.push({ collection, key, local: mine ?? null, remote: theirs ?? null }); continue; }
      const selected = choice === 'local' ? mine : theirs;
      if (selected !== undefined) merged.push(selected);
      continue;
    }
    const selected = remoteChanged ? theirs : mine;
    if (selected !== undefined) merged.push(selected);
  }
  return merged;
}

function semanticError(manifest: BackupManifestV4): string | null {
  const names = new Set<string>();
  for (const tag of manifest.tags) {
    const name = tag.name.toLocaleLowerCase();
    if (names.has(name)) return `标签重名：${tag.name}`;
    names.add(name);
  }
  const ordinalKeys = new Set<string>();
  const activeBooks = new Set<string>();
  for (const session of manifest.readingSessions) {
    const key = `${session.bookId}\0${session.ordinal}`;
    if (ordinalKeys.has(key)) return '同一本书的阅读次数重复';
    ordinalKeys.add(key);
    if (session.outcome === 'reading') {
      if (activeBooks.has(session.bookId)) return '同一本书存在多次进行中的阅读';
      activeBooks.add(session.bookId);
    }
  }
  return null;
}

export function mergeManifests(base: BackupManifestV4, local: BackupManifestV4, remote: BackupManifestV4, choices: ConflictChoices = {}): MergeResult {
  // Reject malformed cloud data before considering a local replacement.
  validateBackupManifest(base);
  validateBackupManifest(local);
  validateBackupManifest(remote);
  const conflicts: SyncConflict[] = [];
  const merged: Record<string, unknown> = { ...local };
  for (const collection of COLLECTIONS) merged[collection] = mergeCollection(collection, base, local, remote, conflicts, choices);
  if (conflicts.length) return { manifest: null, conflicts };
  const draft = merged as BackupManifestV4;
  draft.counts = countsFromManifest(draft);
  try { validateBackupManifest(draft); }
  catch (error) {
    return { manifest: null, conflicts: [{ collection: 'structure', key: 'references', local: null, remote: null, reason: String(error) }] };
  }
  const problem = semanticError(draft);
  if (problem) return { manifest: null, conflicts: [{ collection: 'structure', key: 'uniqueness', local: null, remote: null, reason: problem }] };
  return { manifest: draft, conflicts: [] };
}
