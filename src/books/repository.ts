import type { Book, BookEditInput, BookInput, EndReadingInput } from './types';

export interface BookRepository {
  create(input: BookInput): Promise<Book>;
  list(): Promise<Book[]>;
  get(id: string): Promise<Book | null>;
  update(id: string, input: BookEditInput): Promise<Book>;
  endReading(id: string, input: EndReadingInput): Promise<Book>;
  delete(id: string): Promise<void>;
}
