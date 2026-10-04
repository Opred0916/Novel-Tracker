import type { Database } from '../storage/database';
import { recapYear } from './recapDates';

export type ThemeRecapSession = { id: string; ordinal: number; outcome: 'finished' | 'dropped'; startedOn: string | null; endedOn: string };
export type ThemeRecapBook = { bookId: string; title: string; coverUri: string | null; ratingHalfStars: number | null; sessions: ThemeRecapSession[] };
export type ThemedRecap = { year: number; rereadSuccess: ThemeRecapBook[]; fiveStar: ThemeRecapBook[]; dropped: ThemeRecapBook[] };

type SessionRow = { id: string; book_id: string; title: string; cover_uri: string | null; rating_half_stars: number | null; ordinal: number; outcome: 'finished' | 'dropped'; started_on: string | null; ended_on: string | null };

function validYear(year: number): boolean { return Number.isInteger(year) && year >= 1 && year <= 9999; }
function compareBook(left: ThemeRecapBook, right: ThemeRecapBook): number { return left.title.localeCompare(right.title, 'zh-CN') || left.bookId.localeCompare(right.bookId); }

export class SqliteThemedRecapRepository {
  constructor(private readonly db: Database) {}

  private async rows(): Promise<SessionRow[]> {
    return this.db.getAllAsync<SessionRow>(`
      SELECT s.id, s.book_id, b.title, a.local_path AS cover_uri, b.rating_half_stars,
        s.ordinal, s.outcome, s.started_on, s.ended_on
      FROM reading_sessions s
      JOIN books b ON b.id = s.book_id
      LEFT JOIN image_assets a ON a.id = b.cover_image_id
      WHERE s.outcome IN ('finished', 'dropped') AND s.ended_on IS NOT NULL
    `);
  }

  async availableYears(currentLocalYear: number): Promise<number[]> {
    if (!validYear(currentLocalYear)) throw new Error('统计年份无效');
    const years = new Set<number>([currentLocalYear]);
    for (const row of await this.rows()) { const year = recapYear(row.ended_on); if (year !== null) years.add(year); }
    return [...years].sort((left, right) => right - left);
  }

  async getYear(year: number): Promise<ThemedRecap> {
    if (!validYear(year)) throw new Error('统计年份无效');
    const rows = (await this.rows()).filter(row => recapYear(row.ended_on) === year);
    const grouped = new Map<string, ThemeRecapBook>();
    for (const row of rows) {
      if (!row.ended_on) continue;
      const book = grouped.get(row.book_id) ?? { bookId: row.book_id, title: row.title, coverUri: row.cover_uri, ratingHalfStars: row.rating_half_stars === null ? null : Number(row.rating_half_stars), sessions: [] };
      book.sessions.push({ id: row.id, ordinal: Number(row.ordinal), outcome: row.outcome, startedOn: row.started_on, endedOn: row.ended_on });
      grouped.set(row.book_id, book);
    }
    const books = [...grouped.values()].map(book => ({ ...book, sessions: book.sessions.sort((left, right) => right.endedOn.localeCompare(left.endedOn) || right.ordinal - left.ordinal) }));
    return {
      year,
      rereadSuccess: books.filter(book => book.sessions.some(session => session.outcome === 'finished' && session.ordinal >= 2)).sort(compareBook),
      fiveStar: books.filter(book => book.ratingHalfStars === 10 && book.sessions.some(session => session.outcome === 'finished')).sort(compareBook),
      dropped: books.filter(book => book.sessions.some(session => session.outcome === 'dropped')).sort(compareBook),
    };
  }
}
