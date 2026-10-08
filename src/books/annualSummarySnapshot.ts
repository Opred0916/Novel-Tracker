import type { ThemePalette } from '../theme/theme';
import type { AnnualStorySummary, AnnualSummaryBook } from './annualSummaryRepository';

export type AnnualSummaryPrivacy = {
  showTitles: boolean;
  showCovers: boolean;
  showArchiveStats: boolean;
};

export type AnnualSummarySnapshot = {
  year: number;
  booksReadCount: number;
  tags: string[];
  books: { bookId: string; title: string; coverUri: string | null }[];
  thoughtCount: number | null;
  currentHighlightCount: number | null;
  privacy: AnnualSummaryPrivacy;
  colors: Pick<ThemePalette, 'primary' | 'primarySoft' | 'background' | 'card' | 'text' | 'mutedText' | 'border' | 'rating'>;
};

export const DEFAULT_ANNUAL_SUMMARY_PRIVACY: AnnualSummaryPrivacy = {
  showTitles: true,
  showCovers: true,
  showArchiveStats: true,
};

function distributed(books: AnnualSummaryBook[], limit: number): AnnualSummaryBook[] {
  if (books.length <= limit) return [...books];
  return Array.from({ length: limit }, (_, index) => books[Math.round(index * (books.length - 1) / (limit - 1))]);
}

function selectPosterBooks(summary: AnnualStorySummary): AnnualSummaryBook[] {
  const chosen: AnnualSummaryBook[] = [];
  const seen = new Set<string>();
  const add = (book: AnnualSummaryBook) => {
    if (chosen.length < 5 && !seen.has(book.bookId)) {
      chosen.push(book);
      seen.add(book.bookId);
    }
  };
  summary.representativeBooks.forEach(add);
  distributed(summary.books, 5).forEach(add);
  summary.books.forEach(add);
  return chosen;
}

export function makeAnnualSummarySnapshot(
  summary: AnnualStorySummary,
  privacy: AnnualSummaryPrivacy,
  palette: ThemePalette,
): AnnualSummarySnapshot {
  return {
    year: summary.year,
    booksReadCount: summary.booksReadCount,
    tags: summary.topTags.slice(0, 3).map(item => item.label),
    books: selectPosterBooks(summary).map(book => ({
      bookId: book.bookId,
      title: privacy.showTitles ? book.title : '',
      coverUri: privacy.showCovers ? book.coverUri : null,
    })),
    thoughtCount: privacy.showArchiveStats ? summary.thoughtCount : null,
    currentHighlightCount: privacy.showArchiveStats ? summary.currentHighlightCount : null,
    privacy: { ...privacy },
    colors: {
      primary: palette.primary,
      primarySoft: palette.primarySoft,
      background: palette.background,
      card: palette.card,
      text: palette.text,
      mutedText: palette.mutedText,
      border: palette.border,
      rating: palette.rating,
    },
  };
}

