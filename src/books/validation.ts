import { BOOK_STATUSES, BOOK_TYPES, type Book, type BookEditInput, type BookInput, type BookType } from './types';

function normalizeType(value: unknown): BookType | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !BOOK_TYPES.includes(value as BookType)) throw new Error('作品类型无效');
  return value as BookType;
}

function normalizeTagIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id.trim())) throw new Error('标签无效');
  return [...new Set(value)];
}

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
  if (input.bookType !== undefined) edited.bookType = normalizeType(input.bookType);
  if (input.tagIds !== undefined) edited.tagIds = normalizeTagIds(input.tagIds);
  if (input.newTags !== undefined) {
    if (!Array.isArray(input.newTags) || input.newTags.some(tag =>
      !tag || typeof tag.id !== 'string' || !tag.id.trim() || typeof tag.name !== 'string' || !tag.name.trim()
    )) throw new Error('新标签无效');
    const names = input.newTags.map(tag => tag.name.trim().toLocaleLowerCase());
    if (new Set(names).size !== names.length || new Set(input.newTags.map(tag => tag.id)).size !== input.newTags.length ||
      !edited.tagIds || input.newTags.some(tag => !edited.tagIds?.includes(tag.id))) {
      throw new Error('新标签无效');
    }
    edited.newTags = input.newTags.map(tag => ({ id: tag.id, name: tag.name.trim() }));
  }
  return edited;
}

export function normalizeBookCreate(
  input: BookInput,
): Pick<Book, 'title' | 'author' | 'status' | 'protagonists' | 'ratingHalfStars' | 'bookType'> & { tagIds: string[] } {
  const normalized = normalizeBookEdit({
    title: input.title,
    author: input.author ?? null,
    status: input.status,
    protagonists: input.protagonists ?? [],
    ratingHalfStars: input.ratingHalfStars ?? null,
    bookType: input.bookType ?? null,
    tagIds: input.tagIds ?? [],
  });
  const ratingHalfStars = normalized.ratingHalfStars ?? null;
  if (normalized.status !== 'finished' && ratingHalfStars !== null) {
    throw new Error('只有读完的小说才能新增评分');
  }
  return { ...normalized, bookType: normalized.bookType ?? null, tagIds: normalized.tagIds ?? [], ratingHalfStars };
}
