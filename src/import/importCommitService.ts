import { randomUUID } from 'expo-crypto';
import type { Database } from '../storage/database';
import { findReadingSessionForNote } from '../books/noteAssociation';
import { normalizeHistoricalReadingDates } from '../books/readingDates';
import type { ReadingSession } from '../books/types';
import { summarizeImport, validateImportReview, type ImportReview, type ImportSummary } from './importReview';
import type { ImportCandidate, ImportNoteDraft, ImportSessionDraft } from './importTypes';

type ExistingBookRow = { id: string; title: string; status: string };
type ExistingNoteRow = { id: string; body: string };
type SessionRow = { id: string; book_id: string; ordinal: number; started_on: string | null; ended_on: string | null; outcome: ReadingSession['outcome'] };

function duplicateKey(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US'); }
function noteKey(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' '); }

export class ImportCommitService {
  constructor(
    private readonly db: Database,
    private readonly idFactory: () => string = randomUUID,
    private readonly nowFactory: () => string = () => new Date().toISOString(),
  ) {}

  async commit(review: ImportReview): Promise<ImportSummary> {
    const issues = validateImportReview(review);
    if (issues.length) throw new Error(`导入预览未通过：${issues[0].message}`);
    const summary = summarizeImport(review);
    const now = this.nowFactory();
    await this.db.withExclusiveTransactionAsync(async txn => {
      const existingBooks = await txn.getAllAsync<ExistingBookRow>('SELECT id, title, status FROM books');
      const booksById = new Map(existingBooks.map(book => [book.id, book]));
      const booksByTitle = new Map(existingBooks.map(book => [duplicateKey(book.title), book]));
      for (const item of review.items) {
        if (item.action === 'skip') continue;
        let bookId: string;
        if (item.action === 'append_notes') {
          if (!item.targetBookId || !booksById.has(item.targetBookId)) throw new Error('追加摘记的目标书籍不存在');
          bookId = item.targetBookId;
        } else {
          const duplicate = booksByTitle.get(duplicateKey(item.candidate.title));
          if (duplicate && !item.acknowledgedDuplicateBookIds.includes(duplicate.id)) throw new Error(`书籍重复：${item.candidate.title}`);
          bookId = this.idFactory();
          await this.insertBook(txn, bookId, item.candidate, now);
          booksById.set(bookId, { id: bookId, title: item.candidate.title, status: item.candidate.status });
          booksByTitle.set(duplicateKey(item.candidate.title), booksById.get(bookId)!);
        }
        const sessionIds = item.action === 'create' ? await this.insertSessions(txn, bookId, item.candidate) : await this.listSessions(txn, bookId);
        const existingNotes = await txn.getAllAsync<ExistingNoteRow>('SELECT id, body FROM notes WHERE book_id = ?', bookId);
        for (const imported of item.candidate.notes) {
          const duplicate = existingNotes.find(note => noteKey(note.body) === noteKey(imported.body));
          if (duplicate && !item.acknowledgedDuplicateNoteIds.includes(duplicate.id)) throw new Error(`摘记重复：${imported.body}`);
          const insertedId = await this.insertNote(txn, bookId, imported, sessionIds, now);
          existingNotes.push({ id: insertedId, body: imported.body });
        }
      }
    });
    return summary;
  }

  private async insertBook(txn: Database, id: string, candidate: ImportCandidate, now: string): Promise<void> {
    await txn.runAsync(
      'INSERT INTO books (id, title, author, status, rating_half_stars, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, candidate.title.trim(), candidate.author, candidate.status, candidate.status === 'finished' ? candidate.ratingHalfStars : null, candidate.bookType, now, now,
    );
    for (const [position, protagonist] of candidate.protagonists.entries()) {
      await txn.runAsync('INSERT INTO book_protagonists (book_id, position, name) VALUES (?, ?, ?)', id, position, protagonist);
    }
    for (const [position, tag] of candidate.tagIds.entries()) {
      const found = await txn.getFirstAsync<{ id: string }>('SELECT id FROM tags WHERE id = ? OR name = ? COLLATE NOCASE LIMIT 1', tag, tag);
      if (!found) throw new Error(`标签不存在：${tag}`);
      await txn.runAsync('INSERT INTO book_tags (book_id, tag_id, position) VALUES (?, ?, ?)', id, found.id, position);
    }
  }

  private async listSessions(txn: Database, bookId: string): Promise<ReadingSession[]> {
    const rows = await txn.getAllAsync<SessionRow>('SELECT * FROM reading_sessions WHERE book_id = ? ORDER BY ordinal ASC', bookId);
    return rows.map(row => ({ id: row.id, bookId: row.book_id, ordinal: row.ordinal, startedOn: row.started_on, endedOn: row.ended_on, outcome: row.outcome }));
  }

  private async insertSessions(txn: Database, bookId: string, candidate: ImportCandidate): Promise<ReadingSession[]> {
    const drafts: ImportSessionDraft[] = candidate.sessions.length ? candidate.sessions : candidate.status === 'want_to_read' ? [] : [{ ordinal: 1, outcome: candidate.status, startedOn: null, endedOn: null }];
    const result: ReadingSession[] = [];
    for (const draft of drafts) {
      const dates = normalizeHistoricalReadingDates(draft.outcome, draft.startedOn, draft.endedOn);
      const session: ReadingSession = { id: this.idFactory(), bookId, ordinal: draft.ordinal, startedOn: dates.startedOn, endedOn: dates.endedOn, outcome: draft.outcome };
      await txn.runAsync('INSERT INTO reading_sessions (id, book_id, ordinal, started_on, ended_on, outcome) VALUES (?, ?, ?, ?, ?, ?)', session.id, bookId, session.ordinal, session.startedOn, session.endedOn, session.outcome);
      result.push(session);
    }
    return result;
  }

  private async insertNote(txn: Database, bookId: string, draft: ImportNoteDraft, sessions: ReadingSession[], createdAt: string): Promise<string> {
    const body = draft.body.trim();
    if (!body) throw new Error('摘记正文不能为空');
    const readingSessionId = draft.originalRecordedOn ? findReadingSessionForNote(draft.originalRecordedOn, sessions) : null;
    const id = this.idFactory();
    await txn.runAsync(
      'INSERT INTO notes (id, book_id, body, created_at, updated_at, reading_session_id, source_kind, original_recorded_on, original_recorded_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, bookId, body, createdAt, createdAt, readingSessionId, 'import', draft.originalRecordedOn, draft.originalRecordedTime,
    );
    return id;
  }
}
