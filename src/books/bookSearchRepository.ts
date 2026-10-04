import type { Database } from '../storage/database';
import type { BookRepository } from './repository';
import { buildNoteSnippet, escapeLikeTerm, normalizeSearchTerms, type BookSearchFilters, type BookSearchResult } from './bookSearch';
import { isValidFinishedDate, sortBookSearchResults } from './bookSearchSort';
import type { Book } from './types';

type SearchRow = { id: string };
type NoteRow = { body: string };
type ImageMatchRow = { image_id: string; recognized_text: string; source: 'highlight' | 'note' };
type FinishedSessionRow = { book_id: string; ended_on: string | null };

function termsMissingFromMetadata(book: Book, terms: string[]): string[] {
  const values = [book.title, book.author ?? '', ...book.protagonists].map(value => value.toLocaleLowerCase());
  return terms.filter(term => !values.some(value => value.includes(term)));
}

export class SqliteBookSearchRepository {
  constructor(private readonly db: Database, private readonly books: Pick<BookRepository, 'get'>) {}

  async search(filters: BookSearchFilters): Promise<BookSearchResult[]> {
    const linkedImageSql = `(EXISTS (SELECT 1 FROM highlight_images h WHERE h.image_id = a.id) OR EXISTS (SELECT 1 FROM note_images ni JOIN notes nn ON nn.id = ni.note_id WHERE ni.image_id = a.id AND nn.book_id = a.book_id))`;
    const terms = normalizeSearchTerms(filters.query);
    const where: string[] = [];
    const args: (string | number | null)[] = [];

    for (const term of terms) {
      const pattern = `%${escapeLikeTerm(term)}%`;
      where.push(`(
        LOWER(b.title) LIKE ? ESCAPE '\\' OR
        LOWER(COALESCE(b.author, '')) LIKE ? ESCAPE '\\' OR
        EXISTS (SELECT 1 FROM book_protagonists p WHERE p.book_id = b.id AND LOWER(p.name) LIKE ? ESCAPE '\\') OR
        EXISTS (SELECT 1 FROM notes n WHERE n.book_id = b.id AND LOWER(n.body) LIKE ? ESCAPE '\\') OR
        EXISTS (
          SELECT 1 FROM image_ocr o JOIN image_assets a ON a.id = o.image_id
          WHERE a.book_id = b.id AND o.status = 'recognized' AND LOWER(COALESCE(o.recognized_text, '')) LIKE ? ESCAPE '\\'
          AND ${linkedImageSql.replace('nn.book_id = a.book_id', 'nn.book_id = b.id')}
        )
      )`);
      args.push(pattern, pattern, pattern, pattern, pattern);
    }
    if (filters.status !== null) { where.push('b.status = ?'); args.push(filters.status); }
    if (filters.bookType !== null) { where.push('b.type = ?'); args.push(filters.bookType); }
    if (filters.tagIds.length) {
      const placeholders = filters.tagIds.map(() => '?').join(', ');
      where.push(`(SELECT COUNT(DISTINCT bt.tag_id) FROM book_tags bt WHERE bt.book_id = b.id AND bt.tag_id IN (${placeholders})) = ?`);
      args.push(...filters.tagIds, filters.tagIds.length);
    }

    const rows = await this.db.getAllAsync<SearchRow>(
      `SELECT b.id FROM books b ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY b.updated_at DESC, b.id ASC`,
      ...args,
    );
    const results: BookSearchResult[] = [];
    for (const row of rows) {
      const book = await this.books.get(row.id);
      if (!book) continue;
      let matchedNoteSnippet: string | null = null;
      const nonMetadataTerms = terms.length ? termsMissingFromMetadata(book, terms) : [];
      if (nonMetadataTerms.length) {
        const notes = await this.db.getAllAsync<NoteRow>('SELECT body FROM notes WHERE book_id = ? ORDER BY created_at DESC, id ASC', book.id);
        const note = notes.find(item => nonMetadataTerms.some(term => item.body.toLocaleLowerCase().includes(term)));
        if (note) {
          const matchedTerm = nonMetadataTerms.find(term => note.body.toLocaleLowerCase().includes(term));
          if (matchedTerm) matchedNoteSnippet = buildNoteSnippet(note.body, matchedTerm);
        }
      }
      let matchedImage: BookSearchResult['matchedImage'] = null;
      if (terms.length) {
        const imageRows = await this.db.getAllAsync<ImageMatchRow>(
          `SELECT o.image_id, o.recognized_text,
             CASE WHEN EXISTS (SELECT 1 FROM highlight_images h WHERE h.image_id = a.id) THEN 'highlight' ELSE 'note' END AS source
           FROM image_ocr o JOIN image_assets a ON a.id = o.image_id
           WHERE a.book_id = ? AND o.status = 'recognized'
             AND ${linkedImageSql}
             AND (${nonMetadataTerms.length ? nonMetadataTerms.map(() => `LOWER(o.recognized_text) LIKE ? ESCAPE '\\'`).join(' OR ') : '0'})
           ORDER BY a.created_at DESC, a.id ASC`,
          book.id,
          ...nonMetadataTerms.map(term => `%${escapeLikeTerm(term)}%`),
        );
        const row = imageRows[0];
        if (row) {
          const matchedTerm = nonMetadataTerms.find(term => row.recognized_text.toLocaleLowerCase().includes(term));
          if (matchedTerm) matchedImage = { imageId: row.image_id, source: row.source, snippet: buildNoteSnippet(row.recognized_text, matchedTerm) };
        }
      }
      results.push({ book, matchedNoteSnippet, matchedImage });
    }

    const sortOrder = filters.sortOrder ?? 'recently_updated';
    const latestFinishedOnByBookId = new Map<string, string>();
    if (sortOrder === 'recently_finished' && results.length) {
      const placeholders = results.map(() => '?').join(', ');
      const finishedRows = await this.db.getAllAsync<FinishedSessionRow>(
        `SELECT book_id, ended_on FROM reading_sessions WHERE outcome = 'finished' AND ended_on IS NOT NULL AND book_id IN (${placeholders})`,
        ...results.map(result => result.book.id),
      );
      for (const row of finishedRows) {
        if (!isValidFinishedDate(row.ended_on)) continue;
        const previous = latestFinishedOnByBookId.get(row.book_id);
        if (!previous || row.ended_on > previous) latestFinishedOnByBookId.set(row.book_id, row.ended_on);
      }
    }

    return sortBookSearchResults(results, sortOrder, latestFinishedOnByBookId);
  }
}
