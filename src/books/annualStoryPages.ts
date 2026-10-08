import type { AnnualStorySummary } from './annualSummaryRepository';
import { isValidRecapDate } from './recapDates';

export type AnnualStoryPageId =
  | 'cover'
  | 'books'
  | 'months'
  | 'preference'
  | 'rating'
  | 'archive'
  | 'reread'
  | 'representative'
  | 'share';

export type AnnualStoryPage = { id: AnnualStoryPageId };

export function buildAnnualStoryPages(summary: AnnualStorySummary): AnnualStoryPage[] {
  if (summary.booksReadCount <= 0 || summary.books.length === 0) return [];
  const pages: AnnualStoryPage[] = [
    { id: 'cover' },
    { id: 'books' },
    { id: 'months' },
  ];
  if (summary.topTags.length > 0 || summary.topBookTypes.length > 0) pages.push({ id: 'preference' });
  if (summary.highestRatingHalfStars !== null && summary.topRatedBooks.length > 0) pages.push({ id: 'rating' });
  if (summary.thoughtCount + summary.thoughtImageCount + summary.currentHighlightCount > 0) pages.push({ id: 'archive' });
  if (summary.rereadBooks.length > 0) pages.push({ id: 'reread' });
  if (summary.representativeBooks.length > 0) pages.push({ id: 'representative' });
  pages.push({ id: 'share' });
  return pages;
}

export function formatAnnualSummaryDate(value: string): string {
  if (!isValidRecapDate(value)) return '';
  return `${Number(value.slice(5, 7))} 月 ${Number(value.slice(8, 10))} 日`;
}

function joinMonths(months: number[]): string {
  const labels = months.map(month => `${month} 月`);
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]}和 ${labels[1]}`;
  return `${labels.slice(0, -1).join('、')}和 ${labels.at(-1)}`;
}

export function peakMonthSentence(summary: AnnualStorySummary): string {
  if (summary.peakMonths.length === 0) return '';
  if (summary.peakMonths.length > 3) return '你的阅读均匀分布在这一年。';
  if (summary.peakMonths.length > 1) return `${joinMonths(summary.peakMonths)}是你最沉浸的月份。`;
  const month = summary.peakMonths[0];
  const count = summary.months.find(item => item.month === month)?.bookCount ?? 0;
  if (summary.booksReadCount === 1 && count === 1) return `${month} 月，你读完了今年唯一一本小说。`;
  return `${month} 月是你最沉浸的月份，你在这个月读完了 ${count} 本小说。`;
}

export function annualBooksSentence(summary: AnnualStorySummary): string {
  const first = summary.firstBook;
  const last = summary.lastBook;
  if (!first || !last) return '';
  if (first.bookId === last.bookId) return `这一年，从《${first.title}》开始，也暂时停在这里。`;
  return `从 ${formatAnnualSummaryDate(first.firstFinishedOn)}的《${first.title}》开始，到 ${formatAnnualSummaryDate(last.lastFinishedOn)}的《${last.title}》结束。`;
}
