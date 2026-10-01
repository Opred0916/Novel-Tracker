import { randomUUID } from 'expo-crypto';
import type { Database } from '../storage/database';
import type { BookRepository } from './repository';
import type { Book, BookInput, BookStatus } from './types';

type BookRow = {
  id: string;
  title: string;
  status: BookStatus;
  created_at: string;
  updated_at: string;
};

function fromRow(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteBookRepository implements BookRepository {
  constructor(private readonly db: Database, private readonly idFactory: () => string = randomUUID) {}

  async create(input: BookInput): Promise<Book> {
    const title = input.title.trim();
    if (!title) throw new Error('请输入书名');
    const now = new Date().toISOString();
    const book: Book = { id: this.idFactory(), title, status: input.status, createdAt: now, updatedAt: now };
    await this.db.runAsync(
      'INSERT INTO books (id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      book.id, book.title, book.status, book.createdAt, book.updatedAt,
    );
    return book;
  }

  async list(): Promise<Book[]> {
    const rows = await this.db.getAllAsync<BookRow>('SELECT * FROM books ORDER BY updated_at DESC, id ASC');
    return rows.map(fromRow);
  }

  async get(id: string): Promise<Book | null> {
    const row = await this.db.getFirstAsync<BookRow>('SELECT * FROM books WHERE id = ?', id);
    return row ? fromRow(row) : null;
  }
}
