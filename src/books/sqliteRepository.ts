import { randomUUID } from 'expo-crypto';
import type { Database } from '../storage/database';
import type { BookRepository } from './repository';
import type { Book, BookEditInput, BookInput, BookStatus, BookType, Tag } from './types';
import { normalizeBookCreate, normalizeBookEdit } from './validation';
import { normalizeReadingDates, todayLocalDate } from './readingDates';

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  status: BookStatus;
  rating_half_stars: number | null;
  type: BookType | null;
  created_at: string;
  updated_at: string;
  legacy_read_count: number;
};

type ProtagonistRow = { book_id: string; position: number; name: string };
type BookTagRow = { book_id: string; id: string; name: string; is_system: number };
type ActiveSessionRow = { id: string; started_on: string };
type NextOrdinalRow = { next_ordinal: number };
type ReadingTransaction = Pick<Database, 'getFirstAsync' | 'runAsync'>;

function fromRow(row: BookRow, protagonists: string[] = [], tags: Tag[] = []): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    status: row.status,
    protagonists,
    ratingHalfStars: row.rating_half_stars,
    bookType: row.type,
    tags,
    legacyReadCount: row.legacy_read_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteBookRepository implements BookRepository {
  constructor(
    private readonly db: Database,
    private readonly idFactory: () => string = randomUUID,
    private readonly todayFactory: () => string = todayLocalDate,
  ) {}

  private async addSession(
    txn: ReadingTransaction,
    bookId: string,
    legacyReadCount: number,
    status: Exclude<BookStatus, 'want_to_read'>,
    dates?: BookInput['readingDates'],
  ): Promise<void> {
    const today = this.todayFactory();
    const normalized = normalizeReadingDates(status, dates?.startedOn ?? today, dates?.endedOn ?? (status === 'reading' ? null : today));
    const next = await txn.getFirstAsync<NextOrdinalRow>(
      'SELECT MAX(ordinal) + 1 AS next_ordinal FROM reading_sessions WHERE book_id = ?', bookId,
    );
    const ordinal = Math.max(legacyReadCount + 1, next?.next_ordinal ?? 1);
    await txn.runAsync(
      'INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES (?, ?, ?, ?, ?, ?)',
      this.idFactory(), bookId, ordinal, normalized.startedOn, normalized.endedOn, status,
    );
  }

  private async applyStatusTransition(
    txn: ReadingTransaction,
    bookId: string,
    previous: BookRow,
    status: BookStatus,
    dates?: BookEditInput['readingDates'],
  ): Promise<void> {
    if (status === previous.status) {
      if (dates) throw new Error('阅读状态未改变，请在阅读历史中修改日期');
      return;
    }
    const active = previous.status === 'reading'
      ? await txn.getFirstAsync<ActiveSessionRow>(
        "SELECT id, started_on FROM reading_sessions WHERE book_id = ? AND outcome = 'reading'", bookId,
      )
      : null;
    if (status === 'want_to_read') {
      if (active) await txn.runAsync('DELETE FROM reading_sessions WHERE id = ?', active.id);
      return;
    }
    if (active && status !== 'reading') {
      const normalized = normalizeReadingDates(
        status, dates?.startedOn ?? active.started_on, dates?.endedOn ?? this.todayFactory(),
      );
      await txn.runAsync(
        'UPDATE reading_sessions SET started_on = ?, ended_on = ?, outcome = ? WHERE id = ?',
        normalized.startedOn, normalized.endedOn, status, active.id,
      );
      return;
    }
    await this.addSession(txn, bookId, previous.legacy_read_count, status, dates);
  }

  async create(input: BookInput): Promise<Book> {
    const normalized = normalizeBookCreate(input);
    const now = new Date().toISOString();
    const id = this.idFactory();
    await this.db.withExclusiveTransactionAsync(async txn => {
      await txn.runAsync(
        'INSERT INTO books (id, title, author, status, rating_half_stars, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id, normalized.title, normalized.author, normalized.status, normalized.ratingHalfStars, normalized.bookType, now, now,
      );
      for (const [position, name] of normalized.protagonists.entries()) {
        await txn.runAsync(
          'INSERT INTO book_protagonists (book_id, position, name) VALUES (?, ?, ?)', id, position, name,
        );
      }
      for (const [position, tagId] of normalized.tagIds.entries()) {
        await txn.runAsync('INSERT INTO book_tags (book_id, tag_id, position) VALUES (?, ?, ?)', id, tagId, position);
      }
      if (normalized.status !== 'want_to_read') {
        await this.addSession(txn, id, 0, normalized.status, normalized.readingDates);
      }
    });
    const result = await this.get(id);
    if (!result) throw new Error('找不到这本小说');
    return result;
  }

  async list(): Promise<Book[]> {
    const rows = await this.db.getAllAsync<BookRow>('SELECT * FROM books ORDER BY updated_at DESC, id ASC');
    const names = await this.db.getAllAsync<ProtagonistRow>(
      'SELECT book_id, position, name FROM book_protagonists ORDER BY book_id, position',
    );
    const tagRows = await this.db.getAllAsync<BookTagRow>(
      'SELECT bt.book_id, t.id, t.name, t.is_system FROM book_tags bt JOIN tags t ON t.id = bt.tag_id ORDER BY bt.book_id, bt.position',
    );
    const grouped = new Map<string, string[]>();
    for (const row of names) {
      const group = grouped.get(row.book_id) ?? [];
      group.push(row.name);
      grouped.set(row.book_id, group);
    }
    const groupedTags = new Map<string, Tag[]>();
    for (const row of tagRows) {
      const group = groupedTags.get(row.book_id) ?? [];
      group.push({ id: row.id, name: row.name, isSystem: row.is_system === 1 });
      groupedTags.set(row.book_id, group);
    }
    return rows.map(row => fromRow(row, grouped.get(row.id) ?? [], groupedTags.get(row.id) ?? []));
  }

  async get(id: string): Promise<Book | null> {
    const row = await this.db.getFirstAsync<BookRow>('SELECT * FROM books WHERE id = ?', id);
    if (!row) return null;
    const names = await this.db.getAllAsync<ProtagonistRow>(
      'SELECT book_id, position, name FROM book_protagonists WHERE book_id = ? ORDER BY position', id,
    );
    const tagRows = await this.db.getAllAsync<BookTagRow>(
      'SELECT bt.book_id, t.id, t.name, t.is_system FROM book_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.book_id = ? ORDER BY bt.position', id,
    );
    return fromRow(row, names.map(name => name.name), tagRows.map(tag => ({ id: tag.id, name: tag.name, isSystem: tag.is_system === 1 })));
  }

  async update(id: string, input: BookEditInput): Promise<Book> {
    const edited = normalizeBookEdit(input);
    await this.db.withExclusiveTransactionAsync(async txn => {
      const existing = await txn.getFirstAsync<BookRow>('SELECT * FROM books WHERE id = ?', id);
      if (!existing) throw new Error('找不到这本小说');
      const ratingHalfStars = edited.ratingHalfStars === undefined
        ? existing.rating_half_stars
        : edited.ratingHalfStars;
      if (edited.status !== 'finished' && ratingHalfStars !== null && ratingHalfStars !== existing.rating_half_stars) {
        throw new Error('只有读完的小说才能新增或修改评分');
      }
      const now = new Date().toISOString();
      await this.applyStatusTransition(txn, id, existing, edited.status, edited.readingDates);
      await txn.runAsync(
        'UPDATE books SET title = ?, author = ?, status = ?, rating_half_stars = ?, type = ?, updated_at = ? WHERE id = ?',
        edited.title, edited.author, edited.status, ratingHalfStars, edited.bookType === undefined ? existing.type : edited.bookType, now, id,
      );
      await txn.runAsync('DELETE FROM book_protagonists WHERE book_id = ?', id);
      for (const [position, name] of edited.protagonists.entries()) {
        await txn.runAsync(
          'INSERT INTO book_protagonists (book_id, position, name) VALUES (?, ?, ?)', id, position, name,
        );
      }
      if (edited.tagIds !== undefined) {
        for (const tag of edited.newTags ?? []) {
          await txn.runAsync('INSERT INTO tags (id, name, is_system) VALUES (?, ?, 0)', tag.id, tag.name);
        }
        await txn.runAsync('DELETE FROM book_tags WHERE book_id = ?', id);
        for (const [position, tagId] of edited.tagIds.entries()) {
          await txn.runAsync('INSERT INTO book_tags (book_id, tag_id, position) VALUES (?, ?, ?)', id, tagId, position);
        }
      }
    });
    const result = await this.get(id);
    if (!result) throw new Error('找不到这本小说');
    return result;
  }
}
