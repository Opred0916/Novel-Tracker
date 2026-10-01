export const BOOK_STATUSES = ['want_to_read', 'reading', 'finished', 'dropped'] as const;

export type BookStatus = (typeof BOOK_STATUSES)[number];

export type Book = {
  id: string;
  title: string;
  author: string | null;
  status: BookStatus;
  protagonists: string[];
  createdAt: string;
  updatedAt: string;
};

export type BookInput = Pick<Book, 'title' | 'status'>;

export type BookEditInput = Pick<Book, 'title' | 'author' | 'status' | 'protagonists'>;
