import { BOOK_STATUSES, BOOK_TYPES, type Book, type BookEditInput, type BookInput, type BookType } from './types';
import { normalizeReadingDates } from './readingDates';

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

function normalizeOptionalText(value: unknown, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error(`${label}无效`);
  const normalized = value.trim();
  return normalized || null;
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
  if (input.whyWantToRead !== undefined) edited.whyWantToRead = normalizeOptionalText(input.whyWantToRead, '想看理由');
  if (input.platform !== undefined) edited.platform = normalizeOptionalText(input.platform, '首发平台');
  if (input.readingDates !== undefined) {
    if (!input.readingDates || typeof input.readingDates !== 'object') throw new Error('阅读日期无效');
    edited.readingDates = normalizeReadingDates(input.status, input.readingDates.startedOn, input.readingDates.endedOn);
  }
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
  if (input.coverChange !== undefined) {
    if (input.coverChange.kind === 'set') {
      if (!input.coverChange.source?.uri || !input.coverChange.source.extension) throw new Error('封面图片无效');
      edited.coverChange = { kind: 'set', source: input.coverChange.source };
    } else if (input.coverChange.kind === 'keep' || input.coverChange.kind === 'remove') {
      edited.coverChange = { kind: input.coverChange.kind };
    } else {
      throw new Error('封面图片无效');
    }
  }
  return edited;
}

export function normalizeBookCreate(
  input: BookInput,
): Pick<Book, 'title' | 'author' | 'status' | 'protagonists' | 'ratingHalfStars' | 'bookType' | 'whyWantToRead' | 'platform'> & { tagIds: string[]; newTags?: BookInput['newTags']; readingDates?: BookInput['readingDates']; coverSource?: BookInput['coverSource'] } {
  const normalized = normalizeBookEdit({
    title: input.title,
    author: input.author ?? null,
    status: input.status,
    protagonists: input.protagonists ?? [],
    ratingHalfStars: input.ratingHalfStars ?? null,
    bookType: input.bookType ?? null,
    whyWantToRead: input.whyWantToRead ?? null,
    platform: input.platform ?? null,
    tagIds: input.tagIds ?? [],
    readingDates: input.readingDates,
  });
  const ratingHalfStars = normalized.ratingHalfStars ?? null;
  if (normalized.status !== 'finished' && ratingHalfStars !== null) {
    throw new Error('只有读完的小说才能新增评分');
  }
  if (input.newTags !== undefined) {
    if (!Array.isArray(input.newTags)) throw new Error('新标签无效');
    const names = input.newTags.map(tag => tag.name.trim().toLocaleLowerCase());
    if (input.newTags.some(tag => !tag.id.trim() || !tag.name.trim()) || new Set(names).size !== names.length || new Set(input.newTags.map(tag => tag.id)).size !== input.newTags.length || input.newTags.some(tag => !normalized.tagIds?.includes(tag.id))) throw new Error('新标签无效');
  }
  return {
    ...normalized,
    bookType: normalized.bookType ?? null,
    tagIds: normalized.tagIds ?? [],
    ratingHalfStars,
    whyWantToRead: normalized.whyWantToRead ?? null,
    platform: normalized.platform ?? null,
    ...(input.newTags ? { newTags: input.newTags.map(tag => ({ id: tag.id, name: tag.name.trim() })) } : {}),
    ...(input.coverSource ? { coverSource: input.coverSource } : {}),
  };
}
