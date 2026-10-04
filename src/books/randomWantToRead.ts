import type { Book } from './types';

export function selectWantToReadBook(
  books: readonly Book[],
  previousId: string | null,
  random: () => number = Math.random,
): Book | null {
  const candidates = books.filter(book => book.status === 'want_to_read');
  if (!candidates.length) return null;
  const withoutPrevious = previousId ? candidates.filter(book => book.id !== previousId) : candidates;
  const pool = withoutPrevious.length ? withoutPrevious : candidates;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  return pool[index] ?? null;
}
