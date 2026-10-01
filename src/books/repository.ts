import type { Book, BookInput } from './types';

export interface BookRepository {
  create(input: BookInput): Promise<Book>;
  list(): Promise<Book[]>;
  get(id: string): Promise<Book | null>;
}
