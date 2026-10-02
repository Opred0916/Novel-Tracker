import { randomUUID } from 'expo-crypto';
import type { Database } from '../storage/database';
import { normalizeReadingDates } from './readingDates';
import type { BookStatus, ReadingSession } from './types';

type SessionRow = {
  id: string;
  book_id: string;
  ordinal: number;
  started_on: string;
  ended_on: string | null;
  outcome: ReadingSession['outcome'];
};
type BookRow = { status: BookStatus; legacy_read_count: number };

function fromRow(row: SessionRow): ReadingSession {
  return {
    id: row.id,
    bookId: row.book_id,
    ordinal: row.ordinal,
    startedOn: row.started_on,
    endedOn: row.ended_on,
    outcome: row.outcome,
  };
}

export class SqliteReadingHistoryRepository {
  constructor(private readonly db: Database, private readonly idFactory: () => string = randomUUID, private readonly onDatesChanged?: (bookId: string) => Promise<void>) {}

  async list(bookId: string): Promise<ReadingSession[]> {
    const rows = await this.db.getAllAsync<SessionRow>(
      'SELECT * FROM reading_sessions WHERE book_id = ? ORDER BY ordinal ASC', bookId,
    );
    return rows.map(fromRow);
  }

  async backfillFirst(bookId: string, startedOn: string, endedOn: string): Promise<ReadingSession> {
    const dates = normalizeReadingDates('finished', startedOn, endedOn);
    const id = this.idFactory();
    await this.db.withExclusiveTransactionAsync(async txn => {
      const book = await txn.getFirstAsync<BookRow>('SELECT status, legacy_read_count FROM books WHERE id = ?', bookId);
      if (!book || book.legacy_read_count !== 1) throw new Error('这本书没有待补记的首刷');
      const first = await txn.getFirstAsync<{ id: string }>(
        'SELECT id FROM reading_sessions WHERE book_id = ? AND ordinal = 1', bookId,
      );
      if (first) throw new Error('首刷记录已经存在');
      await txn.runAsync(
        'INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES (?, ?, 1, ?, ?, ?)',
        id, bookId, dates.startedOn, dates.endedOn, 'finished',
      );
      await txn.runAsync('UPDATE books SET legacy_read_count = 0, updated_at = ? WHERE id = ?', new Date().toISOString(), bookId);
    });
    return { id, bookId, ordinal: 1, startedOn: dates.startedOn, endedOn: dates.endedOn, outcome: 'finished' };
  }

  async updateDates(bookId: string, sessionId: string, startedOn: string, endedOn: string | null): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async txn => {
      const session = await txn.getFirstAsync<SessionRow>(
        'SELECT * FROM reading_sessions WHERE book_id = ? AND id = ?', bookId, sessionId,
      );
      if (!session) throw new Error('找不到这次阅读');
      const dates = normalizeReadingDates(session.outcome, startedOn, endedOn);
      await txn.runAsync(
        'UPDATE reading_sessions SET started_on = ?, ended_on = ? WHERE book_id = ? AND id = ?',
        dates.startedOn, dates.endedOn, bookId, sessionId,
      );
    });
    await this.onDatesChanged?.(bookId);
  }

  async delete(bookId: string, sessionId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async txn => {
      const book = await txn.getFirstAsync<BookRow>('SELECT status, legacy_read_count FROM books WHERE id = ?', bookId);
      const session = await txn.getFirstAsync<SessionRow>(
        'SELECT * FROM reading_sessions WHERE book_id = ? AND id = ?', bookId, sessionId,
      );
      if (!book || !session) throw new Error('找不到这次阅读');
      const latest = await txn.getFirstAsync<{ ordinal: number }>(
        'SELECT ordinal FROM reading_sessions WHERE book_id = ? ORDER BY ordinal DESC LIMIT 1', bookId,
      );
      await txn.runAsync('DELETE FROM reading_sessions WHERE book_id = ? AND id = ?', bookId, sessionId);
      if (latest?.ordinal === session.ordinal && book.status === session.outcome) {
        const previous = await txn.getFirstAsync<{ outcome: 'finished' | 'dropped' }>(
          "SELECT outcome FROM reading_sessions WHERE book_id = ? AND outcome != 'reading' ORDER BY ordinal DESC LIMIT 1", bookId,
        );
        const fallback = previous?.outcome ?? (book.legacy_read_count === 1 ? 'finished' : 'want_to_read');
        await txn.runAsync('UPDATE books SET status = ?, updated_at = ? WHERE id = ?', fallback, new Date().toISOString(), bookId);
      }
    });
  }
}
