export type BookStatus = 'want_to_read' | 'reading' | 'finished' | 'dropped';

export type Book = {
  id: string;
  title: string;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
};

export type BookInput = Pick<Book, 'title' | 'status'>;
