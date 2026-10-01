import { randomUUID } from 'expo-crypto';
import type { Database } from '../storage/database';
import type { BookRepository } from './repository';
import type { Book, BookEditInput, BookInput, BookStatus } from './types';
import { normalizeBookEdit } from './validation';

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  status: BookStatus;
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
    const book: Book = { id: this.idFactory(), title, author: null, status: input.status, protagonists: [], createdAt: now, updatedAt: now };
    await this.db.runAsync(
      'INSERT INTO books (id, title, author, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      book.id, book.title, book.author, book.status, book.createdAt, book.updatedAt,
    );
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
      const now = new Date().toISOString();
      await txn.runAsync(
        'UPDATE books SET title = ?, author = ?, status = ?, updated_at = ? WHERE id = ?',
        edited.title, edited.author, edited.status, now, id,
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
