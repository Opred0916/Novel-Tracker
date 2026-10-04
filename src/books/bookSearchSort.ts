import type { BookSearchResult, BookSortOrder } from './bookSearch';

export function isValidFinishedDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function compareDescending(left: string, right: string): number {
  return left === right ? 0 : left > right ? -1 : 1;
}

function compareStable(left: BookSearchResult, right: BookSearchResult): number {
  return compareDescending(left.book.updatedAt, right.book.updatedAt) || left.book.id.localeCompare(right.book.id);
}

export function sortBookSearchResults(
  results: BookSearchResult[],
  order: BookSortOrder,
  latestFinishedOnByBookId: ReadonlyMap<string, string>,
): BookSearchResult[] {
  return [...results].sort((left, right) => {
    if (order === 'recently_finished') {
      const leftDate = latestFinishedOnByBookId.get(left.book.id) ?? null;
      const rightDate = latestFinishedOnByBookId.get(right.book.id) ?? null;
      if (leftDate === null && rightDate !== null) return 1;
      if (leftDate !== null && rightDate === null) return -1;
      if (leftDate !== null && rightDate !== null) {
        const dateComparison = compareDescending(leftDate, rightDate);
        if (dateComparison) return dateComparison;
      }
      return compareStable(left, right);
    }

    if (order === 'recently_added') {
      return compareDescending(left.book.createdAt, right.book.createdAt) || compareStable(left, right);
    }

    if (order === 'rating_high') {
      const leftRating = left.book.ratingHalfStars;
      const rightRating = right.book.ratingHalfStars;
      if (leftRating === null && rightRating !== null) return 1;
      if (leftRating !== null && rightRating === null) return -1;
      if (leftRating !== null && rightRating !== null && leftRating !== rightRating) return rightRating - leftRating;
      return compareStable(left, right);
    }

    return compareStable(left, right);
  });
}
