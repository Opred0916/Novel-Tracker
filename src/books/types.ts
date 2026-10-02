export const BOOK_STATUSES = ['want_to_read', 'reading', 'finished', 'dropped'] as const;

export type BookStatus = (typeof BOOK_STATUSES)[number];

export const BOOK_TYPES = ['romance_male_male', 'romance_female_male', 'romance_female_female', 'no_romance', 'other'] as const;
export type BookType = (typeof BOOK_TYPES)[number];
export type Tag = { id: string; name: string; isSystem: boolean };
export type ReadingDatesInput = { startedOn: string; endedOn?: string | null };
export type ReadingSession = {
  id: string;
  bookId: string;
  ordinal: number;
  startedOn: string;
  endedOn: string | null;
  outcome: Exclude<BookStatus, 'want_to_read'>;
};

export type Book = {
  id: string;
  title: string;
  author: string | null;
  status: BookStatus;
  protagonists: string[];
  ratingHalfStars: number | null;
  bookType: BookType | null;
  tags: Tag[];
  legacyReadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BookInput = Pick<Book, 'title' | 'status'> &
  Partial<Pick<Book, 'author' | 'protagonists' | 'ratingHalfStars' | 'bookType'>> & { tagIds?: string[]; readingDates?: ReadingDatesInput };

export type BookEditInput = Pick<Book, 'title' | 'author' | 'status' | 'protagonists'> &
  Partial<Pick<Book, 'ratingHalfStars' | 'bookType'>> & {
    tagIds?: string[];
    newTags?: Pick<Tag, 'id' | 'name'>[];
    readingDates?: ReadingDatesInput;
  };

export type ImageAsset = {
  id: string;
  bookId: string;
  localPath: string;
  createdAt: string;
};

export type Note = {
  id: string;
  bookId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  readingSessionId: string | null;
  images: ImageAsset[];
};

export type NoteInput = { body: string; imageIds?: string[]; createdAt?: string };
export type HighlightImage = ImageAsset & { position: number };
