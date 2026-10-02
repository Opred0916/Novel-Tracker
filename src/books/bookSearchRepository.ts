import type { Database } from '../storage/database';
import type { BookRepository } from './repository';
import { buildNoteSnippet, escapeLikeTerm, normalizeSearchTerms, type BookSearchFilters, type BookSearchResult } from './bookSearch';
import type { Book } from './types';

type SearchRow = { id: string };
type NoteRow = { body: string };

function metadataMatchesAll(book: Book, terms: string[]): boolean {
  const values = [book.title, book.author ?? '', ...book.protagonists].map(value => value.toLocaleLowerCase());
  return terms.every(term => values.some(value => value.includes(term)));
}

export class SqliteBookSearchRepository {
  constructor(private readonly db: Database, private readonly books: Pick<BookRepository, 'get'>) {}

  async search(filters: BookSearchFilters): Promise<BookSearchResult[]> {
    const terms = normalizeSearchTerms(filters.query);
    const where: string[] = [];
    const args: (string | number | null)[] = [];

    for (const term of terms) {
      const pattern = `%${escapeLikeTerm(term)}%`;
      where.push(`(
        LOWER(b.title) LIKE ? ESCAPE '\\' OR
        LOWER(COALESCE(b.author, '')) LIKE ? ESCAPE '\\' OR
        EXISTS (SELECT 1 FROM book_protagonists p WHERE p.book_id = b.id AND LOWER(p.name) LIKE ? ESCAPE '\\') OR
        EXISTS (SELECT 1 FROM notes n WHERE n.book_id = b.id AND LOWER(n.body) LIKE ? ESCAPE '\\')
      )`);
      args.push(pattern, pattern, pattern, pattern);
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
      if (terms.length && !metadataMatchesAll(book, terms)) {
        const notes = await this.db.getAllAsync<NoteRow>('SELECT body FROM notes WHERE book_id = ? ORDER BY created_at DESC, id ASC', book.id);
        const note = notes.find(item => terms.some(term => item.body.toLocaleLowerCase().includes(term)));
        if (note) {
          const matchedTerm = terms.find(term => note.body.toLocaleLowerCase().includes(term));
          if (matchedTerm) matchedNoteSnippet = buildNoteSnippet(note.body, matchedTerm);
        }
      }
      results.push({ book, matchedNoteSnippet });
    }
    return results;
  }
}
