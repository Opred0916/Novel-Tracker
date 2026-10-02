import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useBooks, useBookSearchRepository, useNotes, useReadingHistory, useTags } from '../../src/storage/AppProvider';
import Bookshelf from '../../src/app/index';
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
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../src/storage/AppProvider', () => ({ useBooks: jest.fn(), useBookSearchRepository: jest.fn(), useTags: jest.fn(), useReadingHistory: jest.fn(), useNotes: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'new-tag-id') }));

const book: Book = {
  id: 'book-1', title: '长夜', author: '某作者', status: 'reading', protagonists: ['阿青'], ratingHalfStars: null, bookType: null, tags: [],
  legacyReadCount: 0, createdAt: '2026-09-29T10:00:00.000Z', updatedAt: '2026-09-29T11:00:00.000Z',
};

const repo = {
  create: jest.fn(),
  list: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
};
const searchRepo = { search: jest.fn() };
const tagRepo = { list: jest.fn(), listQuick: jest.fn(), create: jest.fn(), setQuick: jest.fn() };
const historyRepo = { list: jest.fn(), backfillFirst: jest.fn(), updateDates: jest.fn(), delete: jest.fn() };
const notesRepo = { listNotes: jest.fn(), listHighlights: jest.fn(), createNote: jest.fn(), updateNote: jest.fn(), deleteNote: jest.fn(), registerImage: jest.fn(), addHighlights: jest.fn(), removeHighlight: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBooks).mockReturnValue(repo as unknown as ReturnType<typeof useBooks>);
  jest.mocked(useBookSearchRepository).mockReturnValue(searchRepo as unknown as ReturnType<typeof useBookSearchRepository>);
  jest.mocked(useTags).mockReturnValue(tagRepo as unknown as ReturnType<typeof useTags>);
  jest.mocked(useReadingHistory).mockReturnValue(historyRepo as unknown as ReturnType<typeof useReadingHistory>);
  jest.mocked(useNotes).mockReturnValue(notesRepo as unknown as ReturnType<typeof useNotes>);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id });
  repo.get.mockResolvedValue(book);
  repo.list.mockResolvedValue([book]);
  repo.update.mockResolvedValue(book);
  searchRepo.search.mockResolvedValue([{ book, matchedNoteSnippet: null }]);
  tagRepo.list.mockResolvedValue([{ id: 'ancient', name: '古代', isSystem: true }]);
  tagRepo.listQuick.mockResolvedValue([{ id: 'ancient', name: '古代', isSystem: true }]);
  historyRepo.list.mockResolvedValue([]);
  notesRepo.listHighlights.mockResolvedValue([]);
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
  await waitFor(() => expect(screen.getByText('悬疑')).toBeTruthy());
  await fireEvent.press(screen.getAllByText('现代')[0]);
  await fireEvent.press(screen.getByText('悬疑'));
  await fireEvent.press(screen.getByText('保存快捷标签'));
  await waitFor(() => expect(tagRepo.setQuick).toHaveBeenCalledWith(['ancient', 'suspense']));
  expect(tagRepo.list).toHaveBeenCalled();
});

test('book card shows author, rating, and an optional matching note snippet', async () => {
  const onPress = jest.fn();
  const screen = await render(<BookCard book={{ ...book, ratingHalfStars: 9 }} matchedNoteSnippet="这是命中的摘记内容" onPress={onPress} />);
  expect(screen.getByText('某作者')).toBeTruthy();
  expect(screen.getByText('4.5 / 5 星')).toBeTruthy();
  expect(screen.getByText('匹配摘记')).toBeTruthy();
  expect(screen.getByText('这是命中的摘记内容')).toBeTruthy();
  expect(screen.queryByText('在读')).toBeNull();
  await fireEvent.press(screen.getByText('长夜'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('bookshelf opens the tapped novel detail page', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('长夜')).toBeTruthy());
  await fireEvent.press(screen.getByText('长夜'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/book/[id]', params: { id: book.id } });
});

test('bookshelf filters by search and clears the filter', async () => {
  const other = { ...book, id: 'book-2', title: '归途', author: '另一作者' };
  searchRepo.search.mockImplementation(async ({ query }: { query: string }) => query
    ? [{ book, matchedNoteSnippet: '长夜之后仍有归途' }]
    : [{ book, matchedNoteSnippet: null }, { book: other, matchedNoteSnippet: null }]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('归途')).toBeTruthy());
  await fireEvent.changeText(screen.getByPlaceholderText('搜索书名、作者、主角或摘记'), '长夜');
  await waitFor(() => expect(screen.queryByText('归途')).toBeNull());
  expect(screen.getByText('匹配摘记')).toBeTruthy();
  await fireEvent.press(screen.getByText('清除筛选'));
  await waitFor(() => expect(screen.getByText('归途')).toBeTruthy());
});

test('bookshelf submits status, type, and every selected tag then clears them together', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('长夜')).toBeTruthy());
  await fireEvent.press(screen.getByText('筛选条件'));
  await fireEvent.press(screen.getByText('在读'));
  await fireEvent.press(screen.getByText('耽美'));
  await fireEvent.press(screen.getByText('古代'));
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith({
    query: '', status: 'reading', bookType: 'romance_male_male', tagIds: ['ancient'],
  }));
  expect(screen.getByText('筛选条件（3）')).toBeTruthy();
  await fireEvent.press(screen.getByText('清除筛选'));
  await waitFor(() => expect(searchRepo.search).toHaveBeenLastCalledWith({
    query: '', status: null, bookType: null, tagIds: [],
  }));
  expect(screen.getByText('筛选条件')).toBeTruthy();
});

test('bookshelf offers retry after a search failure', async () => {
  searchRepo.search.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce([{ book, matchedNoteSnippet: null }]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('搜索失败，请重试')).toBeTruthy());
  expect(screen.queryByText('书架还是空的')).toBeNull();
  expect(screen.queryByText('没有符合条件的小说')).toBeNull();
  await fireEvent.press(screen.getByText('重试'));
  await waitFor(() => expect(screen.getByText('长夜')).toBeTruthy());
  expect(searchRepo.search).toHaveBeenCalledTimes(2);
});

test('bookshelf keeps old results visible while a new search is loading', async () => {
  let resolveSearch!: (value: { book: Book; matchedNoteSnippet: null }[]) => void;
  const pending = new Promise<{ book: Book; matchedNoteSnippet: null }[]>(resolve => { resolveSearch = resolve; });
  searchRepo.search.mockResolvedValueOnce([{ book, matchedNoteSnippet: null }]).mockReturnValueOnce(pending);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('长夜')).toBeTruthy());
  await fireEvent.changeText(screen.getByPlaceholderText('搜索书名、作者、主角或摘记'), '新条件');
  await waitFor(() => expect(screen.getByLabelText('正在搜索')).toBeTruthy());
  expect(screen.getByText('长夜')).toBeTruthy();
  await act(async () => { resolveSearch([{ book, matchedNoteSnippet: null }]); });
});

test('bookshelf refreshes results on returning to focus without clearing conditions', async () => {
  const updatedBook = { ...book, title: '长夜·修订版' };
  searchRepo.search.mockResolvedValueOnce([{ book, matchedNoteSnippet: null }]).mockResolvedValueOnce([{ book: updatedBook, matchedNoteSnippet: null }]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('长夜')).toBeTruthy());
  await act(async () => { mockFocusCallback?.(); });
  await waitFor(() => expect(screen.getByText('长夜·修订版')).toBeTruthy());
});

test('detail page loads the novel and offers an edit entry', async () => {
  const screen = await render(<BookPage />);
  await waitFor(() => expect(screen.getByText('某作者')).toBeTruthy());
  expect(screen.getByText('阿青')).toBeTruthy();
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
    title: '长夜', author: '新作者', status: 'reading', protagonists: ['阿青'], ratingHalfStars: null, bookType: null, tagIds: [],
  }));
  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
});

test('custom tags are not written when editing is abandoned', async () => {
  const screen = await render(<EditBookPage />);
  await waitFor(() => expect(screen.getByDisplayValue('长夜')).toBeTruthy());
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
