import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useBooks, useTags } from '../../src/storage/AppProvider';
import Bookshelf from '../../src/app/index';
import NewBook from '../../src/app/book/new';
import QuickTagsPage from '../../src/app/settings/tags';
import BookPage from '../../src/app/book/[id]';
import EditBookPage from '../../src/app/book/[id]/edit';
import { BookCard } from '../../src/books/BookCard';
import type { Book } from '../../src/books/types';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => require('react').useEffect(callback, [callback]),
  useLocalSearchParams: jest.fn(),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../src/storage/AppProvider', () => ({ useBooks: jest.fn(), useTags: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'new-tag-id') }));

const book: Book = {
  id: 'book-1', title: '长夜', author: '某作者', status: 'reading', protagonists: ['阿青'], ratingHalfStars: null, bookType: null, tags: [],
  createdAt: '2026-09-29T10:00:00.000Z', updatedAt: '2026-09-29T11:00:00.000Z',
};

const repo = {
  create: jest.fn(),
  list: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
};
const tagRepo = { list: jest.fn(), listQuick: jest.fn(), create: jest.fn(), setQuick: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBooks).mockReturnValue(repo as unknown as ReturnType<typeof useBooks>);
  jest.mocked(useTags).mockReturnValue(tagRepo as unknown as ReturnType<typeof useTags>);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id });
  repo.get.mockResolvedValue(book);
  repo.list.mockResolvedValue([book]);
  repo.update.mockResolvedValue(book);
  tagRepo.list.mockResolvedValue([{ id: 'ancient', name: '古代', isSystem: true }]);
  tagRepo.listQuick.mockResolvedValue([{ id: 'ancient', name: '古代', isSystem: true }]);
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

test('book card shows author and rating without repeating the status filter', async () => {
  const onPress = jest.fn();
  const screen = await render(<BookCard book={{ ...book, ratingHalfStars: 9 }} onPress={onPress} />);
  expect(screen.getByText('某作者')).toBeTruthy();
  expect(screen.getByText('4.5 / 5 星')).toBeTruthy();
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
  repo.list.mockResolvedValue([book, { ...book, id: 'book-2', title: '归途', author: '另一作者' }]);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('归途')).toBeTruthy());
  await fireEvent.changeText(screen.getByPlaceholderText('搜索书名、作者或主角'), '长夜');
  expect(screen.queryByText('归途')).toBeNull();
  await fireEvent.press(screen.getByText('清除筛选'));
  expect(screen.getByText('归途')).toBeTruthy();
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
