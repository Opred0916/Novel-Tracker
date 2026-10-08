import type { Database } from '../storage/database';
import { getNoteRecordedOn } from './annualRecapRepository';
import { isValidRecapDate, recapYear } from './recapDates';
import { BOOK_TYPE_LABELS } from './TypePicker';
import type { BookType, Note } from './types';

export type AnnualSummaryBook = {
  bookId: string;
  title: string;
  author: string | null;
  coverUri: string | null;
  bookType: BookType | null;
  tags: { id: string; name: string }[];
  ratingHalfStars: number | null;
  firstFinishedOn: string;
  lastFinishedOn: string;
  rereadCompletionCount: number;
  annualThoughtCount: number;
  annualThoughtImageCount: number;
  currentHighlightCount: number;
};

export type AnnualCount = { key: string; label: string; count: number };
export type AnnualMonth = { month: number; bookCount: number; books: AnnualSummaryBook[] };
export type AnnualThoughtBook = {
  bookId: string;
  title: string;
  coverUri: string | null;
  annualThoughtCount: number;
  annualThoughtImageCount: number;
};

export type AnnualStorySummary = {
  year: number;
  booksReadCount: number;
  books: AnnualSummaryBook[];
  coverBooks: AnnualSummaryBook[];
  firstBook: AnnualSummaryBook | null;
  lastBook: AnnualSummaryBook | null;
  months: AnnualMonth[];
  peakMonths: number[];
  topTags: AnnualCount[];
  topBookTypes: AnnualCount[];
  topAuthors: AnnualCount[];
  highestRatingHalfStars: number | null;
  topRatedBooks: AnnualSummaryBook[];
  fiveStarBookCount: number;
  thoughtCount: number;
  thoughtBookCount: number;
  thoughtImageCount: number;
  currentHighlightCount: number;
  mostThoughtBooks: AnnualThoughtBook[];
  rereadBooks: AnnualSummaryBook[];
  representativeBooks: AnnualSummaryBook[];
};

type FinishedRow = {
  book_id: string;
  title: string;
  author: string | null;
  cover_uri: string | null;
  type: BookType | null;
  rating_half_stars: number | null;
  ordinal: number;
  ended_on: string | null;
};

type TagRow = { book_id: string; id: string; name: string; position: number };
type NoteRow = {
  id: string;
  book_id: string;
  title: string;
  cover_uri: string | null;
  created_at: string;
  source_kind: Note['sourceKind'];
  original_recorded_on: string | null;
  image_count: number;
};
type HighlightRow = { book_id: string; image_id: string };

type ThoughtStats = {
  bookId: string;
  title: string;
  coverUri: string | null;
  count: number;
  imageCount: number;
};

function validYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1 && year <= 9999;
}

function compareText(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function normalizeAuthor(author: string | null): string | null {
  const value = author?.trim();
  return value ? value : null;
}

function sortedCounts(values: Map<string, { label: string; bookIds: Set<string> }>): AnnualCount[] {
  return [...values.entries()].map(([key, value]) => ({ key, label: value.label, count: value.bookIds.size }))
    .sort((left, right) => right.count - left.count || compareText(left.label, right.label) || compareText(left.key, right.key));
}

function winners(values: AnnualCount[], cap: number): AnnualCount[] {
  const highest = values[0]?.count ?? 0;
  return highest >= 2 ? values.filter(value => value.count === highest).slice(0, cap) : [];
}

function selectDistributedBooks(books: AnnualSummaryBook[], limit = 6): AnnualSummaryBook[] {
  if (books.length <= limit) return [...books];
  const selected: AnnualSummaryBook[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < limit; index += 1) {
    const sourceIndex = Math.round(index * (books.length - 1) / (limit - 1));
    const book = books[sourceIndex];
    if (!seen.has(book.bookId)) {
      selected.push(book);
      seen.add(book.bookId);
    }
  }
  return selected;
}

export class SqliteAnnualSummaryRepository {
  constructor(private readonly db: Database) {}

  private finishedRows(): Promise<FinishedRow[]> {
    return this.db.getAllAsync<FinishedRow>(`
      SELECT b.id AS book_id, b.title, b.author, a.local_path AS cover_uri,
        b.type, b.rating_half_stars, s.ordinal, s.ended_on
      FROM reading_sessions s
      JOIN books b ON b.id = s.book_id
      LEFT JOIN image_assets a ON a.id = b.cover_image_id
      WHERE s.outcome = 'finished' AND s.ended_on IS NOT NULL
    `);
  }

  private tagRows(): Promise<TagRow[]> {
    return this.db.getAllAsync<TagRow>(`
      SELECT bt.book_id, t.id, t.name, bt.position
      FROM book_tags bt
      JOIN tags t ON t.id = bt.tag_id
      ORDER BY bt.book_id, bt.position, t.name, t.id
    `);
  }

  private noteRows(): Promise<NoteRow[]> {
    return this.db.getAllAsync<NoteRow>(`
      SELECT n.id, n.book_id, b.title, a.local_path AS cover_uri, n.created_at,
        n.source_kind, n.original_recorded_on, COUNT(DISTINCT ni.image_id) AS image_count
      FROM notes n
      JOIN books b ON b.id = n.book_id
      LEFT JOIN image_assets a ON a.id = b.cover_image_id
      LEFT JOIN note_images ni ON ni.note_id = n.id
      GROUP BY n.id, n.book_id, b.title, a.local_path, n.created_at,
        n.source_kind, n.original_recorded_on
    `);
  }

  private highlightRows(): Promise<HighlightRow[]> {
    return this.db.getAllAsync<HighlightRow>('SELECT book_id, image_id FROM highlight_images');
  }

  async availableYears(currentLocalYear: number): Promise<number[]> {
    if (!validYear(currentLocalYear)) throw new Error('统计年份无效');
    const years = new Set<number>([currentLocalYear]);
    for (const row of await this.finishedRows()) {
      const year = recapYear(row.ended_on);
      if (year !== null) years.add(year);
    }
    for (const row of await this.noteRows()) {
      const recordedOn = getNoteRecordedOn({
        sourceKind: row.source_kind,
        originalRecordedOn: row.original_recorded_on,
        createdAt: row.created_at,
      });
      const year = recapYear(recordedOn);
      if (year !== null) years.add(year);
    }
    return [...years].sort((left, right) => right - left);
  }

  async getYear(year: number): Promise<AnnualStorySummary> {
    if (!validYear(year)) throw new Error('统计年份无效');
    const [allFinished, allTags, allNotes, allHighlights] = await Promise.all([
      this.finishedRows(), this.tagRows(), this.noteRows(), this.highlightRows(),
    ]);

    const finished = allFinished.filter(row => recapYear(row.ended_on) === year && isValidRecapDate(row.ended_on));
    const tagsByBook = new Map<string, { id: string; name: string }[]>();
    for (const row of allTags) {
      const tags = tagsByBook.get(row.book_id) ?? [];
      if (!tags.some(tag => tag.id === row.id)) tags.push({ id: row.id, name: row.name });
      tagsByBook.set(row.book_id, tags);
    }

    const thoughtStats = new Map<string, ThoughtStats>();
    let thoughtCount = 0;
    let thoughtImageCount = 0;
    for (const row of allNotes) {
      const recordedOn = getNoteRecordedOn({
        sourceKind: row.source_kind,
        originalRecordedOn: row.original_recorded_on,
        createdAt: row.created_at,
      });
      if (recapYear(recordedOn) !== year) continue;
      thoughtCount += 1;
      thoughtImageCount += Number(row.image_count);
      const stats = thoughtStats.get(row.book_id) ?? {
        bookId: row.book_id,
        title: row.title,
        coverUri: row.cover_uri,
        count: 0,
        imageCount: 0,
      };
      stats.count += 1;
      stats.imageCount += Number(row.image_count);
      thoughtStats.set(row.book_id, stats);
    }

    const highlightsByBook = new Map<string, Set<string>>();
    for (const row of allHighlights) {
      const images = highlightsByBook.get(row.book_id) ?? new Set<string>();
      images.add(row.image_id);
      highlightsByBook.set(row.book_id, images);
    }

    const sessionsByBook = new Map<string, FinishedRow[]>();
    for (const row of finished) {
      const rows = sessionsByBook.get(row.book_id) ?? [];
      rows.push(row);
      sessionsByBook.set(row.book_id, rows);
    }

    const books = [...sessionsByBook.entries()].map(([bookId, rows]) => {
      rows.sort((left, right) => compareText(left.ended_on!, right.ended_on!) || Number(left.ordinal) - Number(right.ordinal));
      const metadata = rows[0];
      const thoughts = thoughtStats.get(bookId);
      return {
        bookId,
        title: metadata.title,
        author: normalizeAuthor(metadata.author),
        coverUri: metadata.cover_uri,
        bookType: metadata.type,
        tags: tagsByBook.get(bookId) ?? [],
        ratingHalfStars: metadata.rating_half_stars === null ? null : Number(metadata.rating_half_stars),
        firstFinishedOn: rows[0].ended_on!,
        lastFinishedOn: rows.at(-1)!.ended_on!,
        rereadCompletionCount: rows.filter(row => Number(row.ordinal) >= 2).length,
        annualThoughtCount: thoughts?.count ?? 0,
        annualThoughtImageCount: thoughts?.imageCount ?? 0,
        currentHighlightCount: highlightsByBook.get(bookId)?.size ?? 0,
      } satisfies AnnualSummaryBook;
    }).sort((left, right) => compareText(left.firstFinishedOn, right.firstFinishedOn)
      || compareText(left.title, right.title)
      || compareText(left.bookId, right.bookId));

    const months: AnnualMonth[] = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, bookCount: 0, books: [] }));
    for (const book of books) months[Number(book.firstFinishedOn.slice(5, 7)) - 1].books.push(book);
    for (const month of months) month.bookCount = month.books.length;
    const peakCount = Math.max(0, ...months.map(month => month.bookCount));
    const peakMonths = peakCount > 0 ? months.filter(month => month.bookCount === peakCount).map(month => month.month) : [];

    const tagCounts = new Map<string, { label: string; bookIds: Set<string> }>();
    const typeCounts = new Map<string, { label: string; bookIds: Set<string> }>();
    const authorCounts = new Map<string, { label: string; bookIds: Set<string> }>();
    for (const book of books) {
      for (const tag of book.tags) {
        const count = tagCounts.get(tag.id) ?? { label: tag.name, bookIds: new Set<string>() };
        count.bookIds.add(book.bookId);
        tagCounts.set(tag.id, count);
      }
      if (book.bookType) {
        const count = typeCounts.get(book.bookType) ?? { label: BOOK_TYPE_LABELS[book.bookType], bookIds: new Set<string>() };
        count.bookIds.add(book.bookId);
        typeCounts.set(book.bookType, count);
      }
      if (book.author) {
        const count = authorCounts.get(book.author) ?? { label: book.author, bookIds: new Set<string>() };
        count.bookIds.add(book.bookId);
        authorCounts.set(book.author, count);
      }
    }

    const ratedBooks = books.filter(book => book.ratingHalfStars !== null);
    const highestRatingHalfStars = ratedBooks.length ? Math.max(...ratedBooks.map(book => book.ratingHalfStars!)) : null;
    const topRatedBooks = highestRatingHalfStars === null ? [] : ratedBooks
      .filter(book => book.ratingHalfStars === highestRatingHalfStars)
      .sort((left, right) => compareText(left.title, right.title) || compareText(left.bookId, right.bookId))
      .slice(0, 4);

    const mostThoughtBooks = [...thoughtStats.values()]
      .sort((left, right) => right.count - left.count || right.imageCount - left.imageCount
        || compareText(left.title, right.title) || compareText(left.bookId, right.bookId))
      .slice(0, 3)
      .map(item => ({
        bookId: item.bookId,
        title: item.title,
        coverUri: item.coverUri,
        annualThoughtCount: item.count,
        annualThoughtImageCount: item.imageCount,
      }));

    const rereadBooks = books.filter(book => book.rereadCompletionCount > 0)
      .sort((left, right) => right.rereadCompletionCount - left.rereadCompletionCount
        || compareText(left.lastFinishedOn, right.lastFinishedOn)
        || compareText(left.title, right.title)
        || compareText(left.bookId, right.bookId))
      .slice(0, 3);

    const representativeCandidates = [...ratedBooks].sort((left, right) =>
      right.ratingHalfStars! - left.ratingHalfStars!
      || right.annualThoughtCount - left.annualThoughtCount
      || right.annualThoughtImageCount - left.annualThoughtImageCount
      || right.currentHighlightCount - left.currentHighlightCount
      || compareText(left.title, right.title)
      || compareText(left.bookId, right.bookId),
    );
    const representativeLeader = representativeCandidates[0];
    const representativeBooks = representativeLeader ? representativeCandidates.filter(book =>
      book.ratingHalfStars === representativeLeader.ratingHalfStars
      && book.annualThoughtCount === representativeLeader.annualThoughtCount
      && book.annualThoughtImageCount === representativeLeader.annualThoughtImageCount
      && book.currentHighlightCount === representativeLeader.currentHighlightCount,
    ).slice(0, 3) : [];

    const annualBookIds = new Set(books.map(book => book.bookId));
    const annualHighlightIds = new Set(allHighlights.filter(row => annualBookIds.has(row.book_id)).map(row => row.image_id));
    const lastBook = [...books].sort((left, right) => compareText(right.lastFinishedOn, left.lastFinishedOn)
      || compareText(left.title, right.title)
      || compareText(left.bookId, right.bookId))[0] ?? null;

    return {
      year,
      booksReadCount: books.length,
      books,
      coverBooks: selectDistributedBooks(books),
      firstBook: books[0] ?? null,
      lastBook,
      months,
      peakMonths,
      topTags: winners(sortedCounts(tagCounts), 3),
      topBookTypes: winners(sortedCounts(typeCounts), 5),
      topAuthors: winners(sortedCounts(authorCounts), 2),
      highestRatingHalfStars,
      topRatedBooks,
      fiveStarBookCount: books.filter(book => book.ratingHalfStars === 10).length,
      thoughtCount,
      thoughtBookCount: thoughtStats.size,
      thoughtImageCount,
      currentHighlightCount: annualHighlightIds.size,
      mostThoughtBooks,
      rereadBooks,
      representativeBooks,
    };
  }
}
