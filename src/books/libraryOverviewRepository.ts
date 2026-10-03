import type { BookStatus } from './types';
import type { Database } from '../storage/database';

export type LibraryOverview = {
  totalBooks: number;
  byStatus: Record<BookStatus, number>;
  finishedBooksThisYear: number;
  year: number;
};

const EMPTY_STATUS_COUNTS = (): Record<BookStatus, number> => ({ want_to_read: 0, reading: 0, finished: 0, dropped: 0 });

export class SqliteLibraryOverviewRepository {
  constructor(private readonly db: Database) {}

  async getOverview(localYear: number): Promise<LibraryOverview> {
    if (!Number.isInteger(localYear) || localYear < 1 || localYear > 9999) throw new Error('统计年份无效');
    const statusRows = await this.db.getAllAsync<{ status: BookStatus; count: number }>('SELECT status, COUNT(*) AS count FROM books GROUP BY status');
    const totalRow = await this.db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM books');
    const start = `${String(localYear).padStart(4, '0')}-01-01`;
    const end = `${String(localYear + 1).padStart(4, '0')}-01-01`;
    const finishedRow = await this.db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(DISTINCT book_id) AS count FROM reading_sessions WHERE outcome = 'finished' AND ended_on >= ? AND ended_on < ?", start, end,
    );
    const byStatus = EMPTY_STATUS_COUNTS();
    for (const row of statusRows) if (row.status in byStatus) byStatus[row.status] = Number(row.count);
    return { totalBooks: Number(totalRow?.count ?? 0), byStatus, finishedBooksThisYear: Number(finishedRow?.count ?? 0), year: localYear };
  }
}
