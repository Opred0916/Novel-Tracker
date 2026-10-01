import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useBooks } from '../../src/storage/AppProvider';
import Bookshelf from '../../src/app/index';
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
jest.mock('../../src/storage/AppProvider', () => ({ useBooks: jest.fn() }));

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

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBooks).mockReturnValue(repo as unknown as ReturnType<typeof useBooks>);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: book.id });
  repo.get.mockResolvedValue(book);
  repo.list.mockResolvedValue([book]);
  repo.update.mockResolvedValue(book);
});

test('book card shows the real status and responds to a tap', async () => {
  const onPress = jest.fn();
  const screen = await render(<BookCard book={book} onPress={onPress} />);
  expect(screen.getByText('在读')).toBeTruthy();
  await fireEvent.press(screen.getByText('长夜'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('bookshelf opens the tapped novel detail page', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('长夜')).toBeTruthy());
  await fireEvent.press(screen.getByText('长夜'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/book/[id]', params: { id: book.id } });
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
    title: '长夜', author: '新作者', status: 'reading', protagonists: ['阿青'], ratingHalfStars: null,
  }));
  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
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
