import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import RecapHome from '../../src/app/(tabs)/recap';
import { useAnnualSummaryRepository, useLibraryOverviewRepository } from '../../src/storage/AppProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: (callback: () => void) => { require('react').useEffect(callback, [callback]); } }));
jest.mock('../../src/storage/AppProvider', () => ({ useAnnualSummaryRepository: jest.fn(), useLibraryOverviewRepository: jest.fn() }));

const year = new Date().getFullYear();
const repository = { availableYears: jest.fn(), getYear: jest.fn() };
const libraryRepository = { getOverview: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAnnualSummaryRepository).mockReturnValue(repository as never);
  jest.mocked(useLibraryOverviewRepository).mockReturnValue(libraryRepository as never);
  libraryRepository.getOverview.mockResolvedValue({ totalBooks: 0, byStatus: { want_to_read: 0, reading: 0, finished: 0, dropped: 0 }, finishedBooksThisYear: 0, year });
  repository.availableYears.mockResolvedValue([year, year - 1]);
  repository.getYear.mockImplementation(async (selectedYear: number) => ({
    year: selectedYear, booksReadCount: selectedYear === year ? 12 : 3,
    thoughtCount: 8, fiveStarBookCount: 2,
  }));
});

test('recap home shows selected year results and only two distinct destinations', async () => {
  const screen = await render(<RecapHome />);
  await waitFor(() => expect(screen.getByText('读完 12 本')).toBeTruthy());
  expect(screen.getByText('留下 8 条想法')).toBeTruthy();
  expect(screen.getByText('五星书 2 本')).toBeTruthy();
  expect(screen.getByText('年度总结')).toBeTruthy();
  expect(screen.getByText('阅读记录')).toBeTruthy();
  expect(screen.queryByText('主题回顾卡片')).toBeNull();
  await fireEvent.press(screen.getByText('年度总结'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/annual-summary', params: { year: String(year) } });
  await fireEvent.press(screen.getByText('阅读记录'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/annual-recap', params: { year: String(year) } });
  await fireEvent.press(screen.getByText(String(year - 1)));
  await waitFor(() => expect(screen.getByText('读完 3 本')).toBeTruthy());
});

test('recap home distinguishes empty year from load failure', async () => {
  repository.getYear.mockRejectedValueOnce(new Error('db failed')).mockResolvedValueOnce({ year, booksReadCount: 0, thoughtCount: 0, fiveStarBookCount: 0 });
  const screen = await render(<RecapHome />);
  await waitFor(() => expect(screen.getByText('读取年度回顾失败，请重试')).toBeTruthy());
  await fireEvent.press(screen.getByText('重试'));
  await waitFor(() => expect(screen.getByText('这一年还没有读完记录')).toBeTruthy());
});
