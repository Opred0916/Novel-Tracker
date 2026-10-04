import type { ThemeRecapBook, ThemedRecap } from './themedRecapRepository';
import type { ThemePalette } from '../theme/theme';

export type RecapShareThemeId = 'rereadSuccess' | 'fiveStar' | 'dropped';
export type RecapShareSnapshot = {
  year: number;
  themeId: RecapShareThemeId;
  title: string;
  description: string;
  totalBooks: number;
  overflowCount: number;
  books: { bookId: string; title: string; coverUri: string | null; endedOn: string }[];
  colors: Pick<ThemePalette, 'primary' | 'primarySoft' | 'background' | 'card' | 'text' | 'mutedText' | 'border'>;
};

const copy = {
  rereadSuccess: { title: '今年二刷成功', description: '这一年完成了第二次或更多次阅读。' },
  fiveStar: { title: '五星书', description: '当前总体评分 5 星，并且这一年确实读完。' },
  dropped: { title: '弃读书', description: '这一年留下过弃读记录。' },
};

export function isRecapShareThemeId(value: unknown): value is RecapShareThemeId {
  return value === 'rereadSuccess' || value === 'fiveStar' || value === 'dropped';
}

export function makeRecapShareSnapshot(recap: ThemedRecap, themeId: RecapShareThemeId, palette: ThemePalette): RecapShareSnapshot | null {
  const source: ThemeRecapBook[] = recap[themeId];
  if (!source.length) return null;
  return {
    year: recap.year,
    themeId,
    ...copy[themeId],
    totalBooks: source.length,
    overflowCount: Math.max(0, source.length - 6),
    books: source.slice(0, 6).map(book => ({ bookId: book.bookId, title: book.title, coverUri: book.coverUri, endedOn: book.sessions[0].endedOn })),
    colors: { primary: palette.primary, primarySoft: palette.primarySoft, background: palette.background, card: palette.card, text: palette.text, mutedText: palette.mutedText, border: palette.border },
  };
}
