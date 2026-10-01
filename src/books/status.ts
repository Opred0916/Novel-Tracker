import type { BookStatus } from './types';

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  want_to_read: '想读',
  reading: '在读',
  finished: '读完',
  dropped: '弃读',
};
