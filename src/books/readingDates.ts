import type { BookStatus } from './types';

export type ReadingDates = { startedOn: string; endedOn: string | null };
export type HistoricalReadingDates = { startedOn: string | null; endedOn: string | null };

export function todayLocalDate(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function normalizeReadingDates(status: BookStatus, startedOn: string, endedOn?: string | null): ReadingDates {
  if (status === 'want_to_read') throw new Error('想读无需阅读日期');
  if (typeof startedOn !== 'string' || !validCalendarDate(startedOn)) throw new Error('开始日期无效，请使用 YYYY-MM-DD');
  if (status === 'reading') {
    if (endedOn != null) throw new Error('在读记录不能填写结束日期');
    return { startedOn, endedOn: null };
  }
  if (typeof endedOn !== 'string' || !validCalendarDate(endedOn)) throw new Error('结束日期无效，请使用 YYYY-MM-DD');
  if (endedOn < startedOn) throw new Error('结束日期不能早于开始日期');
  return { startedOn, endedOn };
}

/**
 * Normalize dates from an imported historical record. Missing dates are
 * intentionally preserved instead of being replaced with today's date.
 */
export function normalizeHistoricalReadingDates(
  status: Exclude<BookStatus, 'want_to_read'>,
  startedOn: string | null,
  endedOn: string | null,
): HistoricalReadingDates {
  if (status === 'reading' && endedOn !== null) throw new Error('在读记录不能填写结束日期');
  if (startedOn !== null && (typeof startedOn !== 'string' || !validCalendarDate(startedOn))) {
    throw new Error('开始日期无效，请使用 YYYY-MM-DD');
  }
  if (endedOn !== null && (typeof endedOn !== 'string' || !validCalendarDate(endedOn))) {
    throw new Error('结束日期无效，请使用 YYYY-MM-DD');
  }
  if (startedOn !== null && endedOn !== null && endedOn < startedOn) {
    throw new Error('结束日期不能早于开始日期');
  }
  return { startedOn, endedOn };
}
