import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useFocusEffect } from 'expo-router';
import OverviewPage from '../../src/app/settings/overview';
import { useLibraryOverviewRepository } from '../../src/storage/AppProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useFocusEffect: (callback: () => void | (() => void)) => { require('react').useEffect(callback, [callback]); } }));
jest.mock('../../src/storage/AppProvider', () => ({ useLibraryOverviewRepository: jest.fn() }));

const repository = { getOverview: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLibraryOverviewRepository).mockReturnValue(repository as never);
  repository.getOverview.mockResolvedValue({ totalBooks: 4, byStatus: { want_to_read: 1, reading: 1, finished: 1, dropped: 1 }, finishedBooksThisYear: 1, year: 2026 });
});

test('shows status totals and refreshes on focus', async () => {
  const screen = await render(<OverviewPage />);
  await waitFor(() => expect(screen.getByText('今年读完 1 本')).toBeTruthy());
  expect(screen.getByText('想读：1')).toBeTruthy();
  expect(screen.getByText('在读：1')).toBeTruthy();
  await act(async () => { await fireEvent.press(screen.getByText('返回书架')); });
  expect(router.back).toHaveBeenCalled();
});

test('shows a retry action after a read failure', async () => {
  repository.getOverview.mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce({ totalBooks: 0, byStatus: { want_to_read: 0, reading: 0, finished: 0, dropped: 0 }, finishedBooksThisYear: 0, year: 2026 });
  const screen = await render(<OverviewPage />);
  await waitFor(() => expect(screen.getByText('读取概览失败，请重试')).toBeTruthy());
  await fireEvent.press(screen.getByText('重试'));
  await waitFor(() => expect(screen.getByText('今年读完 0 本')).toBeTruthy());
});
