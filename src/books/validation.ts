import { BOOK_STATUSES, type BookEditInput } from './types';

export function normalizeBookEdit(input: BookEditInput): BookEditInput {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) throw new Error('请输入书名');
  if (!BOOK_STATUSES.includes(input.status)) throw new Error('阅读状态无效');
  if (!Array.isArray(input.protagonists) || input.protagonists.some(name => typeof name !== 'string')) {
    throw new Error('主角名字无效');
  }

  const author = typeof input.author === 'string' ? input.author.trim() : '';
  return {
    title,
    author: author || null,
    status: input.status,
    protagonists: input.protagonists.map(name => name.trim()).filter(Boolean),
  };
}
