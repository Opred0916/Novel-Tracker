import { BOOK_STATUSES, type Book, type BookEditInput, type BookInput } from './types';

function normalizeRatingHalfStars(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error('评分必须是 0.5 到 5 星，并以半星递增');
  }
  return value;
}

export function normalizeBookEdit(input: BookEditInput): BookEditInput {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) throw new Error('请输入书名');
  if (!BOOK_STATUSES.includes(input.status)) throw new Error('阅读状态无效');
  if (!Array.isArray(input.protagonists) || input.protagonists.some(name => typeof name !== 'string')) {
    throw new Error('主角名字无效');
  }

  const author = typeof input.author === 'string' ? input.author.trim() : '';
  const edited: BookEditInput = {
    title,
    author: author || null,
    status: input.status,
    protagonists: input.protagonists.map(name => name.trim()).filter(Boolean),
  };
  if (input.ratingHalfStars !== undefined) {
    edited.ratingHalfStars = normalizeRatingHalfStars(input.ratingHalfStars);
  }
  return edited;
}

export function normalizeBookCreate(
  input: BookInput,
): Pick<Book, 'title' | 'author' | 'status' | 'protagonists' | 'ratingHalfStars'> {
  const normalized = normalizeBookEdit({
    title: input.title,
    author: input.author ?? null,
    status: input.status,
    protagonists: input.protagonists ?? [],
    ratingHalfStars: input.ratingHalfStars ?? null,
  });
  const ratingHalfStars = normalized.ratingHalfStars ?? null;
  if (normalized.status !== 'finished' && ratingHalfStars !== null) {
    throw new Error('只有读完的小说才能新增评分');
  }
  return { ...normalized, ratingHalfStars };
}
