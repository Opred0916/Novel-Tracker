import type { Database } from '../storage/database';
import type { Note } from './types';

export type RecapSession = {
  id: string;
  ordinal: number;
  startedOn: string | null;
  endedOn: string;
};

export type RecapBook = {
  bookId: string;
  title: string;
  coverUri: string | null;
  sessions: RecapSession[];
};

export type RecapNote = {
  id: string;
  bookId: string;
  bookTitle: string;
  body: string;
  recordedOn: string | null;
  recordedTime: string | null;
  imageCount: number;
};

export type AnnualRecap = {
  year: number;
  finishedBookCount: number;
  completedReadingCount: number;
  thoughtCount: number;
  books: RecapBook[];
  thoughts: RecapNote[];
};

type FinishedSessionRow = {
  id: string;
  book_id: string;
  title: string;
  cover_uri: string | null;
  ordinal: number;
  started_on: string | null;
  ended_on: string | null;
};

type NoteRow = {
  id: string;
  book_id: string;
  title: string;
  body: string;
  created_at: string;
  source_kind: Note['sourceKind'];
  original_recorded_on: string | null;
  original_recorded_time: string | null;
  image_count: number;
};

function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1 && year <= 9999;
}

function isValidCalendarDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function localDateAndTime(value: string): { date: string; time: string } | null {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const date = `${String(parsed.getFullYear()).padStart(4, '0')}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  const time = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

function validOriginalTime(value: string | null): string | null {
  if (!value || !/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const [hours = 0, minutes = 0, seconds = 0] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return value.length === 5
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getNoteRecordedOn(note: Pick<Note, 'sourceKind' | 'originalRecordedOn' | 'createdAt'>): string | null {
  if (note.sourceKind === 'import') return isValidCalendarDate(note.originalRecordedOn) ? note.originalRecordedOn : null;
  return localDateAndTime(note.createdAt)?.date ?? null;
}

function noteDateAndTime(row: NoteRow): { date: string | null; time: string | null } {
  if (row.source_kind === 'import') {
    return {
      date: isValidCalendarDate(row.original_recorded_on) ? row.original_recorded_on : null,
      time: validOriginalTime(row.original_recorded_time),
    };
  }
  const local = localDateAndTime(row.created_at);
  return { date: local?.date ?? null, time: local?.time ?? null };
}

function compareDescending(left: string, right: string): number {
  return left === right ? 0 : left > right ? -1 : 1;
}

function compareAscending(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function readYear(value: string): number | null {
  return isValidCalendarDate(value) ? Number(value.slice(0, 4)) : null;
}

export class SqliteAnnualRecapRepository {
  constructor(private readonly db: Database) {}

  private async finishedSessions(): Promise<FinishedSessionRow[]> {
    return this.db.getAllAsync<FinishedSessionRow>(`
      SELECT s.id, s.book_id, b.title, a.local_path AS cover_uri,
        s.ordinal, s.started_on, s.ended_on
      FROM reading_sessions s
      JOIN books b ON b.id = s.book_id
      LEFT JOIN image_assets a ON a.id = b.cover_image_id
      WHERE s.outcome = 'finished' AND s.ended_on IS NOT NULL
    `);
  }

  private async noteRows(): Promise<NoteRow[]> {
    return this.db.getAllAsync<NoteRow>(`
      SELECT n.id, n.book_id, b.title, n.body, n.created_at, n.source_kind,
        n.original_recorded_on, n.original_recorded_time, COUNT(ni.image_id) AS image_count
      FROM notes n
      JOIN books b ON b.id = n.book_id
      LEFT JOIN note_images ni ON ni.note_id = n.id
      GROUP BY n.id, n.book_id, b.title, n.body, n.created_at, n.source_kind,
        n.original_recorded_on, n.original_recorded_time
    `);
  }

  async availableYears(currentLocalYear: number): Promise<number[]> {
    if (!isValidYear(currentLocalYear)) throw new Error('统计年份无效');
    const years = new Set<number>([currentLocalYear]);
    for (const session of await this.finishedSessions()) {
      const year = session.ended_on ? readYear(session.ended_on) : null;
      if (year !== null) years.add(year);
    }
    for (const row of await this.noteRows()) {
      const year = noteDateAndTime(row).date ? Number(noteDateAndTime(row).date!.slice(0, 4)) : null;
      if (year !== null) years.add(year);
    }
    return [...years].sort((left, right) => right - left);
  }

  async getYear(year: number): Promise<AnnualRecap> {
    if (!isValidYear(year)) throw new Error('统计年份无效');
    const sessions = (await this.finishedSessions()).filter(session => readYear(session.ended_on ?? '') === year);
    const booksById = new Map<string, RecapBook>();
    for (const session of sessions) {
      const book = booksById.get(session.book_id) ?? { bookId: session.book_id, title: session.title, coverUri: session.cover_uri, sessions: [] };
      book.sessions.push({ id: session.id, ordinal: Number(session.ordinal), startedOn: isValidCalendarDate(session.started_on) ? session.started_on : null, endedOn: session.ended_on! });
      booksById.set(session.book_id, book);
    }
    const books = [...booksById.values()];
    for (const book of books) {
      book.sessions.sort((left, right) => compareDescending(left.endedOn, right.endedOn) || right.ordinal - left.ordinal || compareAscending(left.id, right.id));
    }
    books.sort((left, right) => compareDescending(left.sessions[0].endedOn, right.sessions[0].endedOn) || compareAscending(left.title, right.title) || compareAscending(left.bookId, right.bookId));

    const thoughts = (await this.noteRows()).map(row => {
      const { date, time } = noteDateAndTime(row);
      return { row, date, time };
    }).filter(item => item.date?.slice(0, 4) === String(year)).sort((left, right) =>
      compareDescending(left.date!, right.date!) || compareDescending(left.time ?? '', right.time ?? '') || compareAscending(left.row.id, right.row.id),
    ).map(item => ({
      id: item.row.id,
      bookId: item.row.book_id,
      bookTitle: item.row.title,
      body: item.row.body,
      recordedOn: item.date,
      recordedTime: item.time,
      imageCount: Number(item.row.image_count),
    }));

    return {
      year,
      finishedBookCount: books.length,
      completedReadingCount: sessions.length,
      thoughtCount: thoughts.length,
      books,
      thoughts,
    };
  }

  async listUndatedThoughts(): Promise<RecapNote[]> {
    return (await this.noteRows()).map(row => {
      const { date, time } = noteDateAndTime(row);
      return { row, date, time };
    }).filter(item => item.date === null).sort((left, right) => compareDescending(left.row.created_at, right.row.created_at) || compareAscending(left.row.id, right.row.id)).map(item => ({
      id: item.row.id,
      bookId: item.row.book_id,
      bookTitle: item.row.title,
      body: item.row.body,
      recordedOn: null,
      recordedTime: null,
      imageCount: Number(item.row.image_count),
    }));
  }
}
