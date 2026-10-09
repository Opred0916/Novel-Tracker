import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AnnualSummaryPage from '../../src/app/settings/annual-summary';
import { useAnnualSummaryRepository } from '../../src/storage/AppProvider';
import type { AnnualStorySummary } from '../../src/books/annualSummaryRepository';

let focusCallback: (() => void | (() => void)) | undefined;

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Stack = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  Stack.Screen = ({ options }: { options: { headerShown?: boolean } }) => <Text>{`header:${String(options.headerShown)}`}</Text>;
  return {
    Stack,
    router: { push: jest.fn(), back: jest.fn() },
    useLocalSearchParams: jest.fn(),
    useFocusEffect: (callback: () => void | (() => void)) => {
      focusCallback = callback;
      return React.useEffect(callback, [callback]);
    },
  };
});
jest.mock('../../src/storage/AppProvider', () => ({ useAnnualSummaryRepository: jest.fn() }));
jest.mock('../../src/books/AnnualStoryPager', () => ({
  AnnualStoryPager: ({ summary }: { summary: AnnualStorySummary }) => {
    const { Text } = require('react-native');
    return <Text>{`故事 ${summary.year}`}</Text>;
  },
}));

const currentYear = new Date().getFullYear();
const baseSummary = {
  year: currentYear, booksReadCount: 1, books: [{ bookId: 'a' }], coverBooks: [], firstBook: null, lastBook: null,
  months: [], peakMonths: [], topTags: [], topBookTypes: [], topAuthors: [], highestRatingHalfStars: null,
  topRatedBooks: [], fiveStarBookCount: 0, thoughtCount: 0, thoughtBookCount: 0, thoughtImageCount: 0,
  currentHighlightCount: 0, mostThoughtBooks: [], rereadBooks: [], representativeBooks: [],
} as unknown as AnnualStorySummary;
const repository = { availableYears: jest.fn(), getYear: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  focusCallback = undefined;
  jest.mocked(useLocalSearchParams).mockReturnValue({} as never);
  jest.mocked(useAnnualSummaryRepository).mockReturnValue(repository as never);
  repository.availableYears.mockResolvedValue([currentYear, currentYear - 1]);
  repository.getYear.mockImplementation(async (year: number) => ({ ...baseSummary, year }));
});

test('opens the selected year from the recap home', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ year: String(currentYear - 1) } as never);
  const screen = await render(<AnnualSummaryPage />);
  await waitFor(() => expect(screen.getByText(`故事 ${currentYear - 1}`)).toBeTruthy());
});

test('loads_current_year_switches_year_and_registers_a_full_screen_close_action', async () => {
  const screen = await render(<AnnualSummaryPage />);
  await waitFor(() => expect(screen.getByText(`故事 ${currentYear}`)).toBeTruthy());
  expect(screen.getByText('header:false')).toBeTruthy();
  expect(repository.getYear).toHaveBeenCalledWith(currentYear);
  await fireEvent.press(screen.getByRole('button', { name: `查看 ${currentYear - 1} 年` }));
  await waitFor(() => expect(screen.getByText(`故事 ${currentYear - 1}`)).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '返回回顾' }));
  expect(router.back).toHaveBeenCalled();
  expect(screen.queryByText('关闭')).toBeNull();
});

test('ignores_a_stale_year_response_and_refreshes_on_focus', async () => {
  let resolveCurrent!: (value: AnnualStorySummary) => void;
  repository.getYear.mockImplementationOnce(() => new Promise(resolve => { resolveCurrent = resolve; }))
    .mockImplementation(async (year: number) => ({ ...baseSummary, year }));
  const screen = await render(<AnnualSummaryPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: `查看 ${currentYear - 1} 年` })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: `查看 ${currentYear - 1} 年` }));
  await waitFor(() => expect(screen.getByText(`故事 ${currentYear - 1}`)).toBeTruthy());
  await act(async () => { resolveCurrent({ ...baseSummary, year: currentYear }); });
  expect(screen.getByText(`故事 ${currentYear - 1}`)).toBeTruthy();
  const callsBeforeFocus = repository.getYear.mock.calls.length;
  await act(async () => { focusCallback?.(); });
  await waitFor(() => expect(repository.getYear.mock.calls.length).toBeGreaterThan(callsBeforeFocus));
});

test('retries_query_failure_and_distinguishes_an_empty_year', async () => {
  repository.getYear.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce({ ...baseSummary, booksReadCount: 0, books: [] });
  const screen = await render(<AnnualSummaryPage />);
  await waitFor(() => expect(screen.getByText('读取年度总结失败，请重试')).toBeTruthy());
  await fireEvent.press(screen.getByText('重试'));
  await waitFor(() => expect(screen.getByText('这一年还没有带完成日期的读完记录')).toBeTruthy());
  expect(screen.queryByText(`故事 ${currentYear}`)).toBeNull();
  await fireEvent.press(screen.getByText('查看阅读记录'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/annual-recap', params: { year: String(currentYear) } });
});
