import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Bookshelf from '../../src/books/BookshelfScreen';
import { useBooks, useBookSearchRepository, useBulkOrganizeRepository, useLibraryOverviewRepository, useNotes, useReadingHistory, useTags } from '../../src/storage/AppProvider';
import { dataSafetyPreferences } from '../../src/dataSafety/preferences';
import { useBookSearch } from '../../src/books/useBookSearch';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => require('react').useEffect(callback, [callback]),
  router: { push: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => {
    const { Slot } = require('../../node_modules/expo-router/build/ui/Slot');
    return require('react').createElement(Slot, null, children);
  },
}));
jest.mock('../../src/storage/AppProvider', () => ({ useBooks: jest.fn(), useBookSearchRepository: jest.fn(), useBulkOrganizeRepository: jest.fn(), useLibraryOverviewRepository: jest.fn(), useTags: jest.fn(), useReadingHistory: jest.fn(), useNotes: jest.fn() }));
jest.mock('../../src/dataSafety/preferences', () => ({ dataSafetyPreferences: { read: jest.fn(), mark: jest.fn() } }));
jest.mock('../../src/books/useBookSearch', () => ({ useBookSearch: jest.fn() }));

const overview = { totalBooks: 0, byStatus: { want_to_read: 0, reading: 0, finished: 0, dropped: 0 }, finishedBooksThisYear: 0, year: 2026 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBooks).mockReturnValue({ list: jest.fn() } as unknown as ReturnType<typeof useBooks>);
  jest.mocked(useBookSearchRepository).mockReturnValue({} as ReturnType<typeof useBookSearchRepository>);
  jest.mocked(useBulkOrganizeRepository).mockReturnValue({} as ReturnType<typeof useBulkOrganizeRepository>);
  jest.mocked(useLibraryOverviewRepository).mockReturnValue({ getOverview: jest.fn().mockResolvedValue(overview) } as unknown as ReturnType<typeof useLibraryOverviewRepository>);
  jest.mocked(useTags).mockReturnValue({ list: jest.fn().mockResolvedValue([]) } as unknown as ReturnType<typeof useTags>);
  jest.mocked(useReadingHistory).mockReturnValue({} as ReturnType<typeof useReadingHistory>);
  jest.mocked(useNotes).mockReturnValue({} as ReturnType<typeof useNotes>);
  jest.mocked(useBookSearch).mockReturnValue({ results: [], loading: false, error: null, resultsCurrent: true, retry: jest.fn() } as unknown as ReturnType<typeof useBookSearch>);
  jest.mocked(dataSafetyPreferences.read).mockResolvedValue(false);
  jest.mocked(dataSafetyPreferences.mark).mockResolvedValue(undefined);
});

test('real empty bookshelf shows the introduction without removing add book', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText(/记录保存在这台设备/)).toBeTruthy());
  expect(screen.getByRole('button', { name: '＋ 添加小说' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '明白了' }));
  expect(screen.queryByText(/记录保存在这台设备/)).toBeNull();
  expect(dataSafetyPreferences.mark).toHaveBeenCalledWith('introSeen');
});

test('learn more hides the card and opens the lasting guide', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByRole('button', { name: '了解备份' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '了解备份' }));
  expect(router.push).toHaveBeenCalledWith('/settings/data-safety');
  expect(screen.queryByText(/记录保存在这台设备/)).toBeNull();
});

test('existing library never sees the first-use card even if search is empty', async () => {
  jest.mocked(useLibraryOverviewRepository).mockReturnValue({ getOverview: jest.fn().mockResolvedValue({ ...overview, totalBooks: 1 }) } as unknown as ReturnType<typeof useLibraryOverviewRepository>);
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('书架还是空的')).toBeTruthy());
  expect(screen.queryByText(/记录保存在这台设备/)).toBeNull();
});

test('a failed overview refocus does not reuse stale empty-shelf evidence', async () => {
  const screen = await render(<Bookshelf />);
  await waitFor(() => expect(screen.getByText(/记录保存在这台设备/)).toBeTruthy());
  const failedOverview = jest.fn().mockRejectedValue(new Error('overview unavailable'));
  jest.mocked(useLibraryOverviewRepository).mockReturnValue({ getOverview: failedOverview } as unknown as ReturnType<typeof useLibraryOverviewRepository>);
  await screen.rerender(<Bookshelf />);
  await waitFor(() => expect(screen.getByText('状态数量暂时无法读取')).toBeTruthy());
  expect(failedOverview).toHaveBeenCalled();
  expect(screen.queryByText(/记录保存在这台设备/)).toBeNull();
});
