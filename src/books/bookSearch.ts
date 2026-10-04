import type { Book, BookStatus, BookType } from './types';

export type BookSearchFilters = {
  query: string;
  status: BookStatus | null;
  bookType: BookType | null;
  tagIds: string[];
};

export type BookSearchResult = {
  book: Book;
  matchedNoteSnippet: string | null;
  matchedImage: {
    imageId: string;
    source: 'highlight' | 'note';
    snippet: string;
  } | null;
};

export function normalizeSearchTerms(query: string): string[] {
  const normalized = query.trim();
  return normalized ? normalized.split(/\s+/u).map(term => term.toLocaleLowerCase()) : [];
}

export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, value => `\\${value}`);
}

export function buildNoteSnippet(body: string, matchedTerm: string, maxLength = 60): string {
  if (body.length <= maxLength) return body;
  if (maxLength <= 2) return body.slice(0, maxLength);
  const index = body.toLocaleLowerCase().indexOf(matchedTerm.toLocaleLowerCase());
  const center = index >= 0 ? index + Math.floor(matchedTerm.length / 2) : 0;
  const contentLength = maxLength - 2;
  const start = Math.max(0, Math.min(body.length - contentLength, center - Math.floor(contentLength / 2)));
  const end = Math.min(body.length, start + contentLength);
  return `${start > 0 ? '…' : ''}${body.slice(start, end)}${end < body.length ? '…' : ''}`;
}
