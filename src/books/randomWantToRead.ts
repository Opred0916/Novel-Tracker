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
  const source = random();
  if (!Number.isFinite(source) || source < 0 || source >= 1) throw new Error('随机数必须在 [0, 1) 范围内');
  const index = Math.floor(source * pool.length);
  return pool[index] ?? null;
}
