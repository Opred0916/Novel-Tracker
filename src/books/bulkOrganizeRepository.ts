import type { Database } from '../storage/database';
import { calculateBulkPreview, type BulkBookSnapshot, type BulkOrganizeDraft, type BulkOrganizePreview } from './bulkOrganize';
import type { BookType, Tag } from './types';

type QueryExecutor = Pick<Database, 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;
type BookRow = { id: string; title: string; author: string | null; updated_at: string; type: BookType | null };
type TagLinkRow = { book_id: string; tag_id: string };
type TagRow = { id: string; name: string; is_system: number };

const PARAMETER_BATCH_SIZE = 400;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function listTags(executor: QueryExecutor): Promise<Tag[]> {
  return (await executor.getAllAsync<TagRow>('SELECT id, name, is_system FROM tags ORDER BY rowid'))
    .map(tag => ({ id: tag.id, name: tag.name, isSystem: tag.is_system === 1 }));
}

async function readSnapshots(executor: QueryExecutor, ids: string[]): Promise<BulkBookSnapshot[]> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [];
  const books: BookRow[] = [];
  const tagLinks: TagLinkRow[] = [];
  for (const batch of chunks(uniqueIds, PARAMETER_BATCH_SIZE)) {
    const placeholders = batch.map(() => '?').join(', ');
    books.push(...await executor.getAllAsync<BookRow>(
      `SELECT id, title, author, updated_at, type FROM books WHERE id IN (${placeholders})`, ...batch,
    ));
    tagLinks.push(...await executor.getAllAsync<TagLinkRow>(
      `SELECT book_id, tag_id FROM book_tags WHERE book_id IN (${placeholders}) ORDER BY book_id, position`, ...batch,
    ));
  }
  const booksById = new Map(books.map(book => [book.id, book]));
  const tagIdsByBookId = new Map<string, string[]>();
  for (const link of tagLinks) tagIdsByBookId.set(link.book_id, [...(tagIdsByBookId.get(link.book_id) ?? []), link.tag_id]);
  if (uniqueIds.some(id => !booksById.has(id))) throw new Error('找不到选中的小说');
  return uniqueIds.map(id => {
    const book = booksById.get(id)!;
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      updatedAt: book.updated_at,
      bookType: book.type,
      tagIds: [...(tagIdsByBookId.get(id) ?? [])],
    };
  });
}

function sameSnapshot(left: BulkBookSnapshot, right: BulkBookSnapshot): boolean {
  return left.id === right.id && left.title === right.title && left.author === right.author &&
    left.updatedAt === right.updatedAt && left.bookType === right.bookType &&
    JSON.stringify(left.tagIds) === JSON.stringify(right.tagIds);
}

export class SqliteBulkOrganizeRepository {
  constructor(private readonly db: Database) {}

  async preview(bookIds: string[], draft: BulkOrganizeDraft): Promise<BulkOrganizePreview> {
    const snapshots = await readSnapshots(this.db, bookIds);
    const tags = await listTags(this.db);
    return calculateBulkPreview(snapshots, tags, draft);
  }

  async apply(preview: BulkOrganizePreview): Promise<{ changedCount: number }> {
    if (!preview.changedCount) throw new Error('没有需要修改的内容');
    let changedCount = 0;
    await this.db.withExclusiveTransactionAsync(async txn => {
      const currentSnapshots = await readSnapshots(txn, preview.items.map(item => item.before.id));
      const currentTags = await listTags(txn);
      let currentPreview: BulkOrganizePreview;
      try {
        currentPreview = calculateBulkPreview(currentSnapshots, currentTags, preview.draft);
      } catch {
        throw new Error('预览已过期，请重新生成');
      }
      const stale = preview.items.length !== currentPreview.items.length || preview.items.some((item, index) => {
        const current = currentPreview.items[index];
        return !current || !sameSnapshot(item.before, current.before);
      });
      if (stale) throw new Error('预览已过期，请重新生成');

      for (const tag of preview.draft.newTags) {
        await txn.runAsync('INSERT INTO tags (id, name, is_system) VALUES (?, ?, 0)', tag.id, tag.name);
      }
      const now = new Date().toISOString();
      for (const item of currentPreview.items.filter(entry => entry.changed)) {
        await txn.runAsync('UPDATE books SET type = ?, updated_at = ? WHERE id = ?', item.after.bookType, now, item.before.id);
        await txn.runAsync('DELETE FROM book_tags WHERE book_id = ?', item.before.id);
        for (const [position, tagId] of item.after.tagIds.entries()) {
          await txn.runAsync('INSERT INTO book_tags (book_id, tag_id, position) VALUES (?, ?, ?)', item.before.id, tagId, position);
        }
      }
      changedCount = currentPreview.changedCount;
    });
    return { changedCount };
  }
}
