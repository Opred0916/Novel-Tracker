import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useBooks, useBookSearchRepository, useBulkOrganizeRepository, useImageOcr, useLibraryOverviewRepository, useNotes, useReadingHistory, useTags } from '../../src/storage/AppProvider';
import Bookshelf from '../../src/books/BookshelfScreen';
import NewBook from '../../src/app/book/new';
import QuickTagsPage from '../../src/app/settings/tags';
import BookPage from '../../src/app/book/[id]';
import EditBookPage from '../../src/app/book/[id]/edit';
import ReadingHistoryPage from '../../src/app/book/[id]/reading/[sessionId]';
import { BookCard } from '../../src/books/BookCard';
import type { Book } from '../../src/books/types';
import { chooseReadingDate } from './chooseReadingDate';

let mockFocusCallback: (() => void | (() => void)) | undefined;
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    mockFocusCallback = callback;
    return require('react').useEffect(callback, [callback]);
  },
  useLocalSearchParams: jest.fn(),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => {
    const { Slot } = require('../../node_modules/expo-router/build/ui/Slot');
    return require('react').createElement(Slot, null, children);
  },
}));
jest.mock('../../src/storage/AppProvider', () => ({ useBooks: jest.fn(), useBookSearchRepository: jest.fn(), useBulkOrganizeRepository: jest.fn(), useLibraryOverviewRepository: jest.fn(), useTags: jest.fn(), useReadingHistory: jest.fn(), useNotes: jest.fn(), useImageOcr: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'new-tag-id') }));
jest.mock('../../src/books/suggestionHistory', () => ({ suggestionHistory: {
  list: jest.fn(async (_kind: string, seed: string[] = []) => [...new Set(seed.filter(Boolean))]),
  remember: jest.fn(async () => undefined),
  remove: jest.fn(async () => undefined),
} }));

const book: Book = {
  id: 'book-1', title: '长夜', author: '某作者', status: 'reading', protagonists: ['阿青'], ratingHalfStars: null, bookType: null, tags: [],
  legacyReadCount: 0, coverImageId: null, coverUri: null, createdAt: '2026-09-29T10:00:00.000Z', updatedAt: '2026-09-29T11:00:00.000Z',
  whyWantToRead: null, platform: null,
};

const repo = {
  create: jest.fn(),
  list: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  endReading: jest.fn(),
};
const searchRepo = { search: jest.fn() };
const bulkOrganizeRepo = { preview: jest.fn(), apply: jest.fn() };
const overviewRepo = { getOverview: jest.fn() };
const tagRepo = { list: jest.fn(), listQuick: jest.fn(), create: jest.fn(), setQuick: jest.fn() };
const historyRepo = { list: jest.fn(), backfillFirst: jest.fn(), updateDates: jest.fn(), delete: jest.fn() };
const notesRepo = { listNotes: jest.fn(), listHighlights: jest.fn(), resolveLinkedImage: jest.fn(), createNote: jest.fn(), updateNote: jest.fn(), deleteNote: jest.fn(), registerImage: jest.fn(), addHighlights: jest.fn(), removeHighlight: jest.fn() };
const imageOcr = { isAvailable: true, schedule: jest.fn(async () => undefined), retry: jest.fn(async () => undefined), get: jest.fn(), progress: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBooks).mockReturnValue(repo as unknown as ReturnType<typeof useBooks>);
  jest.mocked(useBookSearchRepository).mockReturnValue(searchRepo as unknown as ReturnType<typeof useBookSearchRepository>);
  jest.mocked(useBulkOrganizeRepository).mockReturnValue(bulkOrganizeRepo as unknown as ReturnType<typeof useBulkOrganizeRepository>);
  jest.mocked(useLibraryOverviewRepository).mockReturnValue(overviewRepo as unknown as ReturnType<typeof useLibraryOverviewRepository>);
  jest.mocked(useTags).mockReturnValue(tagRepo as unknown as ReturnType<typeof useTags>);
  jest.mocked(useReadingHistory).mockReturnValue(historyRepo as unknown as ReturnType<typeof useReadingHistory>);
  jest.mocked(useNotes).mockReturnValue(notesRepo as unknown as ReturnType<typeof useNotes>);
  jest.mocked(useImageOcr).mockReturnValue(imageOcr as unknown as ReturnType<typeof useImageOcr>);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id });
  repo.get.mockResolvedValue(book);
  repo.list.mockResolvedValue([book]);
  repo.update.mockResolvedValue(book);
  searchRepo.search.mockResolvedValue([{ book, matchedNoteSnippet: null }]);
  overviewRepo.getOverview.mockResolvedValue({ totalBooks: 4, byStatus: { want_to_read: 1, reading: 2, finished: 1, dropped: 0 }, finishedBooksThisYear: 1, year: 2026 });
  bulkOrganizeRepo.preview.mockResolvedValue({
    draft: { addTagIds: ['ancient'], removeTagIds: [], newTags: [], typeChange: { kind: 'keep' } },
    items: [{ before: { id: book.id, title: book.title, author: book.author, updatedAt: book.updatedAt, bookType: book.bookType, tagIds: [] }, after: { bookType: book.bookType, tagIds: ['ancient'] }, addedTagIds: ['ancient'], removedTagIds: [], typeChanged: false, changed: true }],
    selectedCount: 1, changedCount: 1, unchangedCount: 0, addAffectedBookCount: 1, removeAffectedBookCount: 0, typeAffectedBookCount: 0,
  });
  bulkOrganizeRepo.apply.mockResolvedValue({ changedCount: 1 });
  tagRepo.list.mockResolvedValue([{ id: 'ancient', name: '古代', isSystem: true }]);
  tagRepo.listQuick.mockResolvedValue([{ id: 'ancient', name: '古代', isSystem: true }]);
  historyRepo.list.mockResolvedValue([]);
  notesRepo.listHighlights.mockResolvedValue([]);
  notesRepo.resolveLinkedImage.mockResolvedValue(null);
  imageOcr.get.mockResolvedValue(null);
  imageOcr.progress.mockResolvedValue({ done: 0, total: 0, failed: 0 });
  notesRepo.listNotes.mockResolvedValue([]);
});

test('new book route loads quick tags and saves the selected tag', async () => {
  repo.create.mockResolvedValue({ ...book, tags: [{ id: 'ancient', name: '古代', isSystem: true }] });
  const screen = await render(<NewBook />);
  await waitFor(() => expect(screen.getByText('古代')).toBeTruthy());
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '长夜');
  await fireEvent.press(screen.getByText('古代'));
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ tagIds: ['ancient'] })));
});

test('new book remains usable when quick tags cannot be read', async () => {
  tagRepo.listQuick.mockRejectedValueOnce(new Error('read failed'));
  repo.create.mockResolvedValue(book);
  const screen = await render(<NewBook />);
  await waitFor(() => expect(screen.getByText('快捷标签读取失败')).toBeTruthy());
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '长夜');
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(repo.create).toHaveBeenCalled());
});

test('quick tag settings save the chosen tags without deleting the library', async () => {
  tagRepo.list.mockResolvedValue([
    { id: 'ancient', name: '古代', isSystem: true },
    { id: 'modern', name: '现代', isSystem: true },
    { id: 'suspense', name: '悬疑', isSystem: true },
  ]);
  tagRepo.listQuick.mockResolvedValue([
    { id: 'ancient', name: '古代', isSystem: true },
    { id: 'modern', name: '现代', isSystem: true },
  ]);
  tagRepo.setQuick.mockResolvedValue(undefined);
  const screen = await render(<QuickTagsPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: '展开情节与设定' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '展开情节与设定' }));
  await fireEvent.press(screen.getAllByText('现代')[0]);
  await fireEvent.press(screen.getByText('悬疑'));
  await fireEvent.press(screen.getByText('保存快捷标签'));
  await waitFor(() => expect(tagRepo.setQuick).toHaveBeenCalledWith(['ancient', 'suspense']));
  expect(tagRepo.list).toHaveBeenCalled();
});

test('book card shows author, rating, and optional note and image matches', async () => {
  const onPress = jest.fn();
  const screen = await render(<BookCard book={{ ...book, ratingHalfStars: 9 }} matchedNoteSnippet="这是命中的摘记内容" matchedImage={{ imageId: 'image-1', source: 'highlight', snippet: '这是图片里的命中文字' }} onPress={onPress} />);
  expect(screen.getByText('某作者')).toBeTruthy();
  expect(screen.getByText('★ 4.5')).toBeTruthy();
  expect(screen.getByText('匹配摘记')).toBeTruthy();
  expect(screen.getByText('这是命中的摘记内容')).toBeTruthy();
  expect(screen.getByText('匹配图片文字')).toBeTruthy();
  expect(screen.getByText('这是图片里的命中文字')).toBeTruthy();
  expect(screen.queryByText('在读')).toBeNull();
  await fireEvent.press(screen.getAllByText('长夜')[0]);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('bookshelf opens the tapped novel detail page', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  await fireEvent.press(screen.getAllByText('长夜')[0]);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/book/[id]', params: { id: book.id } });
});

test('bookshelf add button renders through the Expo Router slot', async () => {
  const screen = await render(<Bookshelf />);
  expect(screen.getByRole('button', { name: '＋ 添加小说' })).toBeTruthy();
  expect(screen.getByTestId('tab-page-header')).toBeTruthy();
});

test('bookshelf searches with recent update sorting by default', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  expect(searchRepo.search).toHaveBeenCalledWith({ query: '', status: null, bookType: null, tagIds: [], sortOrder: 'recently_updated' });
});

test('bookshelf shows status counts at the top and filters by a tapped status', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByRole('radio', { name: '在读 2 本' })).toBeTruthy());
  expect(screen.getByRole('radio', { name: '全部 4 本' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: '弃读 0 本' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: '在读 2 本' }));
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'reading' })));
  expect(screen.getByRole('radio', { name: '在读 2 本' }).props.accessibilityState).toEqual({ checked: true });
});

test('quick record appears only on the reading shelf and opens the selected book', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  expect(screen.queryByRole('button', { name: '快捷记录《长夜》' })).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: '在读 2 本' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '快捷记录《长夜》' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '快捷记录《长夜》' }));
  await waitFor(() => expect(screen.getByText('写想法')).toBeTruthy());
  expect(router.push).not.toHaveBeenCalled();
});

test('finishing from the quick sheet refreshes the reading list and counts', async () => {
  const screen = await render(<Bookshelf />);
  await fireEvent.press(await screen.findByRole('radio', { name: '在读 2 本' }));
  await fireEvent.press(await screen.findByRole('button', { name: '快捷记录《长夜》' }));
  await fireEvent.press(await screen.findByText('标记读完'));
  const beforeSearch = searchRepo.search.mock.calls.length;
  const beforeOverview = overviewRepo.getOverview.mock.calls.length;
  await fireEvent.press(screen.getByText('确认读完'));
  await waitFor(() => expect(repo.endReading).toHaveBeenCalledWith(book.id, expect.objectContaining({ outcome: 'finished' })));
  await waitFor(() => expect(searchRepo.search.mock.calls.length).toBeGreaterThan(beforeSearch));
  expect(overviewRepo.getOverview.mock.calls.length).toBeGreaterThan(beforeOverview);
});

test('bookshelf random pick uses the full library instead of search results', async () => {
  const wantToRead = { ...book, id: 'book-want', title: '想读书', status: 'want_to_read' as const };
  repo.list.mockResolvedValue([book, wantToRead]);
  searchRepo.search.mockResolvedValue([]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('书架还是空的')).toBeTruthy());
  await fireEvent.press(screen.getByText('更多'));
  await fireEvent.press(screen.getByText('随机想读'));
  await waitFor(() => expect(screen.getByText('随机抽到')).toBeTruthy());
  expect(screen.getAllByText('想读书').length).toBeGreaterThan(0);
  expect(repo.list).toHaveBeenCalled();
});

test('bookshelf changes sort order and keeps it when filters are cleared', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  await fireEvent.press(screen.getByText('排序：最近修改'));
  expect(screen.getByRole('radio', { name: '最近读完' }).props.accessibilityState).toMatchObject({ checked: false });
  await fireEvent.press(screen.getByText('最近读完'));
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith({ query: '', status: null, bookType: null, tagIds: [], sortOrder: 'recently_finished' }));
  expect(screen.getByText('排序：最近读完')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('搜索书名、作者、主角、摘记或图片文字'), '长夜');
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith({ query: '长夜', status: null, bookType: null, tagIds: [], sortOrder: 'recently_finished' }));
  await fireEvent.press(screen.getByLabelText('清除搜索'));
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith({ query: '', status: null, bookType: null, tagIds: [], sortOrder: 'recently_finished' }));
});

test('want-to-read sorting excludes recently finished and resets an incompatible selection', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  await fireEvent.press(screen.getByText('排序：最近修改'));
  await fireEvent.press(screen.getByText('最近读完'));
  await fireEvent.press(screen.getByRole('radio', { name: '想读 1 本' }));
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'want_to_read', sortOrder: 'recently_updated' })));
  await fireEvent.press(screen.getByText('排序：最近修改'));
  expect(screen.queryByText('最近读完')).toBeNull();
});

test('bookshelf refreshes a nondefault sort after returning from detail', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  await fireEvent.press(screen.getByText('排序：最近修改'));
  await fireEvent.press(screen.getByText('最近读完'));
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith(expect.objectContaining({ sortOrder: 'recently_finished' })));
  await act(async () => { mockFocusCallback?.(); });
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith({ query: '', status: null, bookType: null, tagIds: [], sortOrder: 'recently_finished' }));
});

test('bookshelf selects books by ID across filters and can remove hidden selections', async () => {
  const other = { ...book, id: 'book-2', title: '归途', author: '另一作者' };
  searchRepo.search.mockImplementation(async ({ query }: { query: string }) => query ? [{ book, matchedNoteSnippet: null }] : [{ book, matchedNoteSnippet: null }, { book: other, matchedNoteSnippet: null }]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('归途').length).toBeGreaterThan(0));
  await fireEvent.press(screen.getByText('更多'));
  await fireEvent.press(screen.getByText('批量整理'));
  await fireEvent.press(screen.getByRole('checkbox', { name: '选择长夜' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '选择归途' }));
  expect(screen.getByText('已选 2 本')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('搜索书名、作者、主角、摘记或图片文字'), '长夜');
  await waitFor(() => expect(screen.queryByText('归途')).toBeNull());
  expect(screen.getByText('已选 2 本')).toBeTruthy();
});

test('bookshelf only selects the completed current result and preserves selection after clearing filters', async () => {
  const other = { ...book, id: 'book-2', title: '归途', author: null };
  searchRepo.search.mockImplementation(async ({ query }: { query: string }) => query ? [{ book, matchedNoteSnippet: null }] : [{ book, matchedNoteSnippet: null }, { book: other, matchedNoteSnippet: null }]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('归途').length).toBeGreaterThan(0));
  await fireEvent.press(screen.getByText('更多'));
  await fireEvent.press(screen.getByText('批量整理'));
  await fireEvent.changeText(screen.getByPlaceholderText('搜索书名、作者、主角、摘记或图片文字'), '长夜');
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith(expect.objectContaining({ query: '长夜' })));
  await fireEvent.press(screen.getByText('全选当前结果'));
  expect(screen.getByText('已选 1 本')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('清除搜索'));
  await waitFor(() => expect(screen.getAllByText('归途').length).toBeGreaterThan(0));
  expect(screen.getByText('已选 1 本')).toBeTruthy();
});

test('bookshelf opens the bulk organizer and confirms the preview', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  await fireEvent.press(screen.getByText('更多'));
  await fireEvent.press(screen.getByText('批量整理'));
  await fireEvent.press(screen.getByRole('checkbox', { name: '选择长夜' }));
  await fireEvent.press(screen.getByTestId('bulk-continue'));
  await waitFor(() => expect(screen.getByText('批量整理 1 本小说')).toBeTruthy());
  await fireEvent.press(screen.getAllByRole('button', { name: '展开背景与世界' })[0]);
  await fireEvent.press(screen.getAllByRole('checkbox')[0]);
  await fireEvent.press(screen.getByText('生成预览'));
  await waitFor(() => expect(screen.getByText('实际会变化 1 本')).toBeTruthy());
  expect(bulkOrganizeRepo.preview).toHaveBeenCalledWith(['book-1'], expect.objectContaining({ addTagIds: ['ancient'] }));
  await fireEvent.press(screen.getByText('确认修改'));
  await waitFor(() => expect(bulkOrganizeRepo.apply).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByText('更多')).toBeTruthy());
});

test('bookshelf filters by search and clears the filter', async () => {
  const other = { ...book, id: 'book-2', title: '归途', author: '另一作者' };
  searchRepo.search.mockImplementation(async ({ query }: { query: string }) => query
    ? [{ book, matchedNoteSnippet: '长夜之后仍有归途' }]
    : [{ book, matchedNoteSnippet: null }, { book: other, matchedNoteSnippet: null }]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('归途').length).toBeGreaterThan(0));
  await fireEvent.changeText(screen.getByPlaceholderText('搜索书名、作者、主角、摘记或图片文字'), '长夜');
  await waitFor(() => expect(screen.queryByText('归途')).toBeNull());
  expect(screen.getByText('匹配摘记')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('清除搜索'));
  await waitFor(() => expect(screen.getAllByText('归途').length).toBeGreaterThan(0));
});

test('bookshelf passes the matched image to the detail page for preview', async () => {
  searchRepo.search.mockResolvedValueOnce([{ book, matchedNoteSnippet: null, matchedImage: { imageId: 'image-1', source: 'highlight', snippet: '图片文字' } }]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('匹配图片文字')).toBeTruthy());
  await fireEvent.press(screen.getAllByText('长夜')[0]);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/book/[id]', params: { id: book.id, focusImageId: 'image-1' } });
});

test('bookshelf keeps maintenance tools in the management tab', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  expect(screen.queryByText('备份与恢复')).toBeNull();
  expect(screen.queryByText('快捷标签设置')).toBeNull();
});

test('bookshelf submits status, type, and every selected tag then clears them together', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  await fireEvent.press(screen.getByRole('radio', { name: '在读 2 本' }));
  await fireEvent.press(screen.getByText('筛选'));
  await fireEvent.press(screen.getByText('BL'));
  await fireEvent.changeText(screen.getByPlaceholderText('搜索标签'), '古代');
  await fireEvent.press(screen.getByText('古代'));
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith({
    query: '', status: 'reading', bookType: 'romance_male_male', tagIds: ['ancient'], sortOrder: 'recently_updated',
  }));
  expect(screen.getByText('筛选')).toBeTruthy();
  await fireEvent.press(screen.getByText('筛选'));
  await fireEvent.press(screen.getByText('重置筛选'));
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith({
    query: '', status: 'reading', bookType: null, tagIds: [], sortOrder: 'recently_updated',
  }));
  expect(screen.getByText('筛选')).toBeTruthy();
});

test('bookshelf offers retry after a search failure', async () => {
  searchRepo.search.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce([{ book, matchedNoteSnippet: null }]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('搜索失败，请重试')).toBeTruthy());
  expect(screen.queryByText('书架还是空的')).toBeNull();
  expect(screen.queryByText('没有符合条件的小说')).toBeNull();
  await fireEvent.press(screen.getByText('重试'));
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  expect(searchRepo.search).toHaveBeenCalledTimes(2);
});

test('bookshelf keeps old results visible while a new search is loading', async () => {
  let resolveSearch!: (value: { book: Book; matchedNoteSnippet: null }[]) => void;
  const pending = new Promise<{ book: Book; matchedNoteSnippet: null }[]>(resolve => { resolveSearch = resolve; });
  searchRepo.search.mockResolvedValueOnce([{ book, matchedNoteSnippet: null }]).mockReturnValueOnce(pending);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  await fireEvent.changeText(screen.getByPlaceholderText('搜索书名、作者、主角、摘记或图片文字'), '新条件');
  await waitFor(() => expect(screen.getByLabelText('正在搜索')).toBeTruthy());
  expect(screen.getAllByText('长夜').length).toBeGreaterThan(0);
  await act(async () => { resolveSearch([{ book, matchedNoteSnippet: null }]); });
});

test('bookshelf refreshes results on returning to focus without clearing conditions', async () => {
  const updatedBook = { ...book, title: '长夜·修订版' };
  searchRepo.search.mockResolvedValueOnce([{ book, matchedNoteSnippet: null }]).mockResolvedValueOnce([{ book: updatedBook, matchedNoteSnippet: null }]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getAllByText('长夜').length).toBeGreaterThan(0));
  await act(async () => { mockFocusCallback?.(); });
  await waitFor(() => expect(screen.getAllByText('长夜·修订版').length).toBeGreaterThan(0));
});

test('detail page loads the novel and offers an edit entry', async () => {
  const screen = await render(<BookPage />);
  await waitFor(() => expect(screen.getByText('某作者')).toBeTruthy());
  expect(screen.getByText('阿青')).toBeTruthy();
  expect(within(screen.getByTestId('book-detail-hero')).getByText('编辑资料')).toBeTruthy();
  await fireEvent.press(screen.getByText('编辑资料'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/book/[id]/edit', params: { id: book.id } });
});

test('detail page can scroll when a novel has many protagonists', async () => {
  repo.get.mockResolvedValue({ ...book, protagonists: Array.from({ length: 30 }, (_, index) => `主角 ${index + 1}`) });
  const screen = await render(<BookPage />);
  await waitFor(() => expect(screen.getByText('主角 30')).toBeTruthy());
  expect(screen.getByTestId('book-detail-scroll')).toBeTruthy();
  expect(screen.getByText('编辑资料')).toBeTruthy();
});

test('edit page preloads details and returns only after a successful update', async () => {
  const screen = await render(<EditBookPage />);
  await waitFor(() => expect(screen.getByDisplayValue('长夜')).toBeTruthy());
  expect(screen.getByDisplayValue('阿青')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('作者名字'), '新作者');
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(repo.update).toHaveBeenCalledWith(book.id, {
    title: '长夜', author: '新作者', status: 'reading', protagonists: ['阿青'], ratingHalfStars: null, bookType: null, tagIds: [], whyWantToRead: null, platform: null,
  }));
  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
});

test('custom tags are not written when editing is abandoned', async () => {
  const screen = await render(<EditBookPage />);
  await waitFor(() => expect(screen.getByDisplayValue('长夜')).toBeTruthy());
  await fireEvent.press(screen.getByText('全部标签'));
  await fireEvent.changeText(screen.getByPlaceholderText('新标签名称'), '赛博朋克');
  await fireEvent.press(screen.getByText('添加标签'));
  await waitFor(() => expect(screen.getByText('赛博朋克')).toBeTruthy());
  expect(tagRepo.create).not.toHaveBeenCalled();
  screen.unmount();
  expect(repo.update).not.toHaveBeenCalled();
});

test('custom tags are submitted atomically with the edited book', async () => {
  const screen = await render(<EditBookPage />);
  await waitFor(() => expect(screen.getByDisplayValue('长夜')).toBeTruthy());
  await fireEvent.press(screen.getByText('全部标签'));
  await fireEvent.changeText(screen.getByPlaceholderText('新标签名称'), '赛博朋克');
  await fireEvent.press(screen.getByText('添加标签'));
  await waitFor(() => expect(screen.getByText('赛博朋克')).toBeTruthy());
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(repo.update).toHaveBeenCalledWith(book.id, expect.objectContaining({
    tagIds: [expect.any(String)], newTags: [{ id: expect.any(String), name: '赛博朋克' }],
  })));
  expect(tagRepo.create).not.toHaveBeenCalled();
});

test('unknown novel ID shows a return path instead of crashing', async () => {
  repo.get.mockResolvedValue(null);
  const screen = await render(<BookPage />);
  await waitFor(() => expect(screen.getByText('找不到这本小说')).toBeTruthy());
  await fireEvent.press(screen.getByText('返回书架'));
  expect(router.replace).toHaveBeenCalledWith('/');
});

test('a read error can be retried without a false success state', async () => {
  repo.get.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce(book);
  const screen = await render(<BookPage />);
  await waitFor(() => expect(screen.getByText('读取小说失败，请重试')).toBeTruthy());
  await fireEvent.press(screen.getByText('重试'));
  await waitFor(() => expect(screen.getByText('某作者')).toBeTruthy());
  expect(repo.get).toHaveBeenCalledTimes(2);
});

test('detail page previews the image selected from search results', async () => {
  const image = { id: 'image-1', bookId: book.id, localPath: 'file:///one.jpg', createdAt: '2026-03-01' };
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id, focusImageId: image.id });
  notesRepo.resolveLinkedImage.mockResolvedValue({ image, source: 'highlight' });
  imageOcr.get.mockResolvedValue({ imageId: image.id, status: 'recognized', recognizedText: '识别内容', errorCode: null });
  const screen = await render(<BookPage />);
  await waitFor(() => expect(screen.getByLabelText('精彩片段预览')).toBeTruthy());
  expect(screen.getByText('图片文字')).toBeTruthy();
  expect(screen.getByText('识别内容')).toBeTruthy();
});

test('detail page focuses only the requested note belonging to the current book', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id, focusNoteId: 'note-1' });
  notesRepo.listNotes.mockResolvedValue([{ id: 'note-1', bookId: book.id, body: '想法正文', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', readingSessionId: null, sourceKind: 'app', originalRecordedOn: null, originalRecordedTime: null, images: [] }]);
  const screen = await render(<BookPage />);
  await waitFor(() => expect(screen.getByTestId('note-note-1')).toBeTruthy());
  expect(screen.getByText('想法正文')).toBeTruthy();
  expect(screen.queryByText('这条想法已不存在')).toBeNull();
});

test('detail page does not show another note when the focus ID is missing', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id, focusNoteId: 'foreign-note' });
  notesRepo.listNotes.mockResolvedValue([{ id: 'note-1', bookId: book.id, body: '当前书的想法', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', readingSessionId: null, sourceKind: 'app', originalRecordedOn: null, originalRecordedTime: null, images: [] }]);
  const screen = await render(<BookPage />);
  await waitFor(() => expect(screen.getByText('这条想法已不存在')).toBeTruthy());
  expect(screen.getByText('当前书的想法')).toBeTruthy();
});

test('detail page asks for confirmation before deleting a novel', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  repo.delete.mockResolvedValue(undefined);
  try {
    const screen = await render(<BookPage />);
    await waitFor(() => expect(screen.getByText('删除小说')).toBeTruthy());
    await fireEvent.press(screen.getByText('删除小说'));
    expect(repo.delete).not.toHaveBeenCalled();
    expect(alert).toHaveBeenLastCalledWith('删除小说', expect.stringContaining('《长夜》'), expect.any(Array));
    let buttons = alert.mock.calls.at(-1)?.[2] as Array<{ text?: string; onPress?: () => void }> | undefined;
    await act(async () => { buttons?.[0]?.onPress?.(); });
    expect(repo.delete).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('删除小说'));
    buttons = alert.mock.calls.at(-1)?.[2] as Array<{ text?: string; onPress?: () => void }> | undefined;
    await act(async () => { await buttons?.[1]?.onPress?.(); });
    await waitFor(() => expect(repo.delete).toHaveBeenCalledWith(book.id));
    expect(router.replace).toHaveBeenCalledWith('/');
  } finally {
    alert.mockRestore();
  }
});

test('detail page stays open and allows retry when novel deletion fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  repo.delete.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);
  try {
    const screen = await render(<BookPage />);
    await waitFor(() => expect(screen.getByText('删除小说')).toBeTruthy());
    await fireEvent.press(screen.getByText('删除小说'));
    let buttons = alert.mock.calls.at(-1)?.[2] as Array<{ onPress?: () => void }> | undefined;
    await act(async () => { await buttons?.[1]?.onPress?.(); });
    await waitFor(() => expect(screen.getByText('删除失败，请重试')).toBeTruthy());
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('删除小说'));
    buttons = alert.mock.calls.at(-1)?.[2] as Array<{ onPress?: () => void }> | undefined;
    await act(async () => { await buttons?.[1]?.onPress?.(); });
    await waitFor(() => expect(repo.delete).toHaveBeenCalledTimes(2));
    expect(router.replace).toHaveBeenCalledWith('/');
  } finally {
    alert.mockRestore();
  }
});

test('detail page disables editing while novel deletion is in progress', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let resolveDelete!: () => void;
  repo.delete.mockReturnValueOnce(new Promise<void>(resolve => { resolveDelete = resolve; }));
  try {
    const screen = await render(<BookPage />);
    await waitFor(() => expect(screen.getByText('删除小说')).toBeTruthy());
    await fireEvent.press(screen.getByText('删除小说'));
    const buttons = alert.mock.calls.at(-1)?.[2] as Array<{ onPress?: () => void }> | undefined;
    await act(async () => { buttons?.[1]?.onPress?.(); });
    await waitFor(() => expect(screen.getByText('正在删除…')).toBeTruthy());
    expect(screen.getByText('编辑资料').parent?.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByText('编辑资料'));
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => { resolveDelete(); });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  } finally {
    alert.mockRestore();
  }
});

test('reading correction route saves edited dates and returns on success', async () => {
  historyRepo.list.mockResolvedValue([{ id: 'session-1', bookId: book.id, ordinal: 1, startedOn: '2026-09-01', endedOn: '2026-09-10', outcome: 'finished' }]);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id, sessionId: 'session-1' });
  historyRepo.updateDates.mockResolvedValue(undefined);
  const screen = await render(<ReadingHistoryPage />);
  await waitFor(() => expect(screen.getByText('2026-09-01')).toBeTruthy());
  await chooseReadingDate(screen, '结束日期', 2026, 9, 15);
  await fireEvent.press(screen.getByText('保存日期'));
  await waitFor(() => expect(historyRepo.updateDates).toHaveBeenCalledWith(book.id, 'session-1', '2026-09-01', '2026-09-15'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('old finished book can backfill its first read from the correction route', async () => {
  repo.get.mockResolvedValue({ ...book, status: 'finished', legacyReadCount: 1 });
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id, sessionId: 'first' });
  historyRepo.backfillFirst.mockResolvedValue(undefined);
  const screen = await render(<ReadingHistoryPage />);
  await waitFor(() => expect(screen.getByText('补记首刷日期')).toBeTruthy());
  await chooseReadingDate(screen, '开始日期', 2026, 8, 1);
  await chooseReadingDate(screen, '结束日期', 2026, 8, 10);
  await fireEvent.press(screen.getByText('保存日期'));
  await waitFor(() => expect(historyRepo.backfillFirst).toHaveBeenCalledWith(book.id, '2026-08-01', '2026-08-10'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('deleting a reading record requires confirmation and does not return after a failure', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  historyRepo.list.mockResolvedValue([{ id: 'session-1', bookId: book.id, ordinal: 1, startedOn: '2026-09-01', endedOn: null, outcome: 'reading' }]);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id, sessionId: 'session-1' });
  historyRepo.delete.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);
  try {
    const screen = await render(<ReadingHistoryPage />);
    await waitFor(() => expect(screen.getByText('删除本次阅读')).toBeTruthy());
    await fireEvent.press(screen.getByText('删除本次阅读'));
    expect(historyRepo.delete).not.toHaveBeenCalled();
    let buttons = alert.mock.calls.at(-1)?.[2];
    await act(async () => { buttons?.[0]?.onPress?.(); });
    expect(historyRepo.delete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('删除本次阅读'));
    buttons = alert.mock.calls.at(-1)?.[2];
    await act(async () => { buttons?.[1]?.onPress?.(); });
    await waitFor(() => expect(screen.getByText('删除失败，请重试')).toBeTruthy());
    expect(router.back).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('删除本次阅读'));
    buttons = alert.mock.calls.at(-1)?.[2];
    await act(async () => { buttons?.[1]?.onPress?.(); });
    await waitFor(() => expect(historyRepo.delete).toHaveBeenCalledTimes(2));
    expect(router.back).toHaveBeenCalledTimes(1);
  } finally { alert.mockRestore(); }
});
