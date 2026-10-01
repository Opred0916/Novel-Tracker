import { randomUUID } from 'expo-crypto';
import type { Database } from '../storage/database';
import type { BookRepository } from './repository';
import type { Book, BookEditInput, BookInput, BookStatus } from './types';
import { normalizeBookCreate, normalizeBookEdit } from './validation';

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  status: BookStatus;
  rating_half_stars: number | null;
  created_at: string;
  updated_at: string;
};

type ProtagonistRow = { book_id: string; position: number; name: string };

function fromRow(row: BookRow, protagonists: string[] = []): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    status: row.status,
    protagonists,
    ratingHalfStars: row.rating_half_stars,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteBookRepository implements BookRepository {
  constructor(private readonly db: Database, private readonly idFactory: () => string = randomUUID) {}

  async create(input: BookInput): Promise<Book> {
    const normalized = normalizeBookCreate(input);
    const now = new Date().toISOString();
    const book: Book = { id: this.idFactory(), ...normalized, createdAt: now, updatedAt: now };
    await this.db.withExclusiveTransactionAsync(async txn => {
      await txn.runAsync(
        'INSERT INTO books (id, title, author, status, rating_half_stars, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        book.id, book.title, book.author, book.status, book.ratingHalfStars, book.createdAt, book.updatedAt,
      );
      for (const [position, name] of book.protagonists.entries()) {
        await txn.runAsync(
          'INSERT INTO book_protagonists (book_id, position, name) VALUES (?, ?, ?)', book.id, position, name,
        );
      }
    });
    return book;
  }

  async list(): Promise<Book[]> {
    const rows = await this.db.getAllAsync<BookRow>('SELECT * FROM books ORDER BY updated_at DESC, id ASC');
    const names = await this.db.getAllAsync<ProtagonistRow>(
      'SELECT book_id, position, name FROM book_protagonists ORDER BY book_id, position',
    );
    const grouped = new Map<string, string[]>();
    for (const row of names) {
      const group = grouped.get(row.book_id) ?? [];
      group.push(row.name);
      grouped.set(row.book_id, group);
    }
    return rows.map(row => fromRow(row, grouped.get(row.id) ?? []));
  }

  async get(id: string): Promise<Book | null> {
    const row = await this.db.getFirstAsync<BookRow>('SELECT * FROM books WHERE id = ?', id);
    if (!row) return null;
    const names = await this.db.getAllAsync<ProtagonistRow>(
      'SELECT book_id, position, name FROM book_protagonists WHERE book_id = ? ORDER BY position', id,
    );
    return fromRow(row, names.map(name => name.name));
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
      await txn.runAsync(
        'UPDATE books SET title = ?, author = ?, status = ?, rating_half_stars = ?, updated_at = ? WHERE id = ?',
        edited.title, edited.author, edited.status, ratingHalfStars, now, id,
      );
      await txn.runAsync('DELETE FROM book_protagonists WHERE book_id = ?', id);
      for (const [position, name] of edited.protagonists.entries()) {
        await txn.runAsync(
          'INSERT INTO book_protagonists (book_id, position, name) VALUES (?, ?, ?)', id, position, name,
        );
      }
    });
    const result = await this.get(id);
    if (!result) throw new Error('找不到这本小说');
    return result;
  }
}
