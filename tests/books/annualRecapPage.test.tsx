import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useFocusEffect } from 'expo-router';
import AnnualRecapPage from '../../src/app/settings/annual-recap';
import { useAnnualRecapRepository } from '../../src/storage/AppProvider';

let focusCallback: (() => void | (() => void)) | undefined;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (callback: () => void | (() => void)) => {
    focusCallback = callback;
    return require('react').useEffect(callback, [callback]);
  },
}));
jest.mock('../../src/storage/AppProvider', () => ({ useAnnualRecapRepository: jest.fn() }));

const repository = { availableYears: jest.fn(), getYear: jest.fn(), listUndatedThoughts: jest.fn() };
const recap2026 = {
  year: 2026,
  finishedBookCount: 1,
  completedReadingCount: 2,
  thoughtCount: 1,
  books: [{
    bookId: 'book-1', title: '长夜', coverUri: null,
    sessions: [
      { id: 'session-2', ordinal: 2, startedOn: null, endedOn: '2026-06-30' },
      { id: 'session-1', ordinal: 1, startedOn: '2026-01-01', endedOn: '2026-01-02' },
    ],
  }],
  thoughts: [{ id: 'note-1', bookId: 'book-1', bookTitle: '长夜', body: '这一年最喜欢的段落', recordedOn: '2026-05-01', recordedTime: '20:30', imageCount: 2 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  focusCallback = undefined;
  jest.mocked(useAnnualRecapRepository).mockReturnValue(repository as never);
  repository.availableYears.mockResolvedValue([2026, 2025]);
  repository.getYear.mockResolvedValue(recap2026);
  repository.listUndatedThoughts.mockResolvedValue([{ id: 'unknown-note', bookId: 'book-2', bookTitle: '旧书', body: '日期未知的想法', recordedOn: null, recordedTime: null, imageCount: 0 }]);
});

test('shows annual counts, reread sessions, thoughts and navigates to book or note', async () => {
  const screen = await render(<AnnualRecapPage />);
  await waitFor(() => expect(screen.getByText('读完 1 本')).toBeTruthy());
  expect(screen.getByText('完成阅读 2 次')).toBeTruthy();
  expect(screen.getByText('留下 1 条想法')).toBeTruthy();
  expect(screen.getByText(/二刷/)).toBeTruthy();
  expect(screen.getByText(/开始日期未记录/)).toBeTruthy();
  expect(screen.getByText('这一年最喜欢的段落')).toBeTruthy();
  expect(screen.getByText('图片 2 张')).toBeTruthy();
  await fireEvent.press(screen.getByText('长夜'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/book/[id]', params: { id: 'book-1' } });
  await fireEvent.press(screen.getByText('这一年最喜欢的段落'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/book/[id]', params: { id: 'book-1', focusNoteId: 'note-1' } });
});

test('switches year and displays undated imported thoughts separately', async () => {
  repository.getYear.mockImplementation(async (year: number) => ({ ...recap2026, year, finishedBookCount: year === 2026 ? 1 : 0, completedReadingCount: year === 2026 ? 2 : 0, thoughtCount: 0, books: [], thoughts: [] }));
  const screen = await render(<AnnualRecapPage />);
  await waitFor(() => expect(screen.getByText('日期未记录')).toBeTruthy());
  expect(screen.getByText('日期未知的想法')).toBeTruthy();
  await fireEvent.press(screen.getByText('2025'));
  await waitFor(() => expect(screen.getByText('读完 0 本')).toBeTruthy());
  expect(repository.getYear).toHaveBeenLastCalledWith(2025);
});

test('shows independent empty states and retries a failed load', async () => {
  repository.getYear.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce({ ...recap2026, books: [], thoughts: [], finishedBookCount: 0, completedReadingCount: 0, thoughtCount: 0 });
  const screen = await render(<AnnualRecapPage />);
  await waitFor(() => expect(screen.getByText('读取年度回顾失败，请重试')).toBeTruthy());
  await fireEvent.press(screen.getByText('重试'));
  await waitFor(() => expect(screen.getByText('这一年还没有带完成日期的阅读记录')).toBeTruthy());
  expect(screen.getByText('这一年还没有记录想法')).toBeTruthy();
});

test('returns to the overview page', async () => {
  const screen = await render(<AnnualRecapPage />);
  await waitFor(() => expect(screen.getByText('年度阅读回顾')).toBeTruthy());
  await fireEvent.press(screen.getByText('返回书库概览'));
  expect(router.back).toHaveBeenCalled();
});
