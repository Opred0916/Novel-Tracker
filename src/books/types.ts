import type { StagedCover } from './bookCoverFiles';

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
  startedOn: string | null;
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
  coverImageId: string | null;
  coverUri: string | null;
  createdAt: string;
  updatedAt: string;
  whyWantToRead: string | null;
  platform: string | null;
};

export type BookInput = Pick<Book, 'title' | 'status'> &
  Partial<Pick<Book, 'author' | 'protagonists' | 'ratingHalfStars' | 'bookType' | 'whyWantToRead' | 'platform'>> & { tagIds?: string[]; newTags?: Pick<Tag, 'id' | 'name'>[]; readingDates?: ReadingDatesInput; coverSource?: StagedCover };

export type BookEditInput = Pick<Book, 'title' | 'author' | 'status' | 'protagonists'> &
  Partial<Pick<Book, 'ratingHalfStars' | 'bookType' | 'whyWantToRead' | 'platform'>> & {
    tagIds?: string[];
    newTags?: Pick<Tag, 'id' | 'name'>[];
    readingDates?: ReadingDatesInput;
    coverChange?: { kind: 'keep' } | { kind: 'remove' } | { kind: 'set'; source: StagedCover };
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
  sourceKind: 'app' | 'import';
  originalRecordedOn: string | null;
  originalRecordedTime: string | null;
  images: ImageAsset[];
};

export type NoteInput = {
  body: string;
  imageIds?: string[];
  createdAt?: string;
  sourceKind?: 'app' | 'import';
  originalRecordedOn?: string | null;
  originalRecordedTime?: string | null;
};
export type HighlightImage = ImageAsset & { position: number };
