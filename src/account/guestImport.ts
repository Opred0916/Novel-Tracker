import { SqliteBackupRepository, type BackupSnapshot } from '../backup/backupRepository';
import { countsFromManifest } from '../backup/backupValidation';
import type { BackupManifestV4 } from '../backup/backupTypes';
import type { Database } from '../storage/database';
import type { ImageFilePort } from '../sync/imageTransport';
import { mergeManifests } from '../sync/merge';
import { LocalSyncStore } from '../sync/localSyncStore';

async function toManifest(snapshot: BackupSnapshot, files: ImageFilePort): Promise<BackupManifestV4> {
  const images = [];
  for (const source of snapshot.images) {
    const bytes = await files.read(source.localPath);
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('图片超过 10 MB 限制');
    images.push({ id: source.id, bookId: source.bookId, createdAt: source.createdAt, extension: source.extension, archivePath: source.archivePath, byteLength: bytes.byteLength });
  }
  const manifest: BackupManifestV4 = {
    ...snapshot.data,
    formatVersion: 4, exportedAt: snapshot.exportedAt, appVersion: snapshot.appVersion,
    books: snapshot.data.books.map(book => ({ ...book, coverImageId: book.coverImageId ?? null, whyWantToRead: book.whyWantToRead ?? null, platform: book.platform ?? null })),
    images,
    counts: countsFromManifest({ ...snapshot.data, images }),
  };
  return manifest;
}

function emptyManifest(): BackupManifestV4 {
  const data = { books: [], protagonists: [], tags: [], bookTags: [], quickTags: [], readingSessions: [], notes: [], noteImages: [], highlightImages: [], images: [] };
  return { formatVersion: 4, exportedAt: new Date().toISOString(), appVersion: '1.0.0', ...data, counts: countsFromManifest(data) };
}

export class GuestImportService {
  private readonly guestRepo: SqliteBackupRepository;
  private readonly accountRepo: SqliteBackupRepository;
  private readonly syncState: LocalSyncStore;

  constructor(private readonly guestDb: Database, private readonly accountDb: Database, private readonly files: ImageFilePort) {
    this.guestRepo = new SqliteBackupRepository(guestDb);
    this.accountRepo = new SqliteBackupRepository(accountDb);
    this.syncState = new LocalSyncStore(accountDb);
  }

  async offer(): Promise<{ guestBooks: number; alreadyImported: boolean }> {
    const count = await this.guestDb.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM books');
    const state = await this.accountDb.getFirstAsync<{ completed: number }>('SELECT completed FROM guest_import_state WHERE id = 1');
    return { guestBooks: count?.count ?? 0, alreadyImported: state?.completed === 1 };
  }

  async import(accountId: string): Promise<void> {
    const offer = await this.offer();
    if (offer.alreadyImported) throw new Error('未登录书库已经导入过');
    if (offer.guestBooks === 0) throw new Error('未登录书库没有可导入的小说');
    const expectedRevision = await this.syncState.readLocalRevision();
    const exportedAt = new Date().toISOString();
    const [guestSnapshot, accountSnapshot] = await Promise.all([
      this.guestRepo.createSnapshot('1.0.0', exportedAt), this.accountRepo.createSnapshot('1.0.0', exportedAt),
    ]);
    const [guest, account] = await Promise.all([toManifest(guestSnapshot, this.files), toManifest(accountSnapshot, this.files)]);
    const merged = mergeManifests(emptyManifest(), account, guest);
    if (!merged.manifest) throw new Error('两边有相同记录但内容不同，请先备份，再手动整理');
    const paths = new Map(accountSnapshot.images.map(image => [image.id, image.localPath]));
    for (const image of guestSnapshot.images) {
      if (paths.has(image.id)) continue;
      const entry = guest.images.find(value => value.id === image.id);
      if (!entry) throw new Error('导入图片清单不完整');
      paths.set(image.id, await this.files.write(accountId, entry, await this.files.read(image.localPath)));
    }
    await this.accountRepo.replaceAll(merged.manifest, paths, expectedRevision);
    await this.accountDb.runAsync('UPDATE guest_import_state SET completed = 1 WHERE id = 1');
  }
}
