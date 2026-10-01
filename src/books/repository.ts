import type { Book, BookEditInput, BookInput } from './types';

export interface BookRepository {
  create(input: BookInput): Promise<Book>;
  list(): Promise<Book[]>;
  get(id: string): Promise<Book | null>;
  update(id: string, input: BookEditInput): Promise<Book>;
}
