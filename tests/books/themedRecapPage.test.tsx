import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ThemedRecapPage from '../../src/app/settings/themed-recap';
import { useAnnualRecapRepository, useThemedRecapRepository } from '../../src/storage/AppProvider';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: jest.fn(() => ({})), useFocusEffect: (callback: () => void | (() => void)) => { require('react').useEffect(callback, [callback]); } }));
jest.mock('../../src/storage/AppProvider', () => ({ useAnnualRecapRepository: jest.fn(), useThemedRecapRepository: jest.fn() }));

const repository = { availableYears: jest.fn(), getYear: jest.fn() };
const annualRepository = { availableYears: jest.fn() };
const recap = {
  year: 2026,
  rereadSuccess: [{ bookId: 'book-1', title: '重读之书', coverUri: null, ratingHalfStars: 10, sessions: [{ id: 's1', ordinal: 2, outcome: 'finished', startedOn: '2026-01-01', endedOn: '2026-01-05' }] }],
  fiveStar: [{ bookId: 'book-1', title: '重读之书', coverUri: null, ratingHalfStars: 10, sessions: [{ id: 's1', ordinal: 2, outcome: 'finished', startedOn: '2026-01-01', endedOn: '2026-01-05' }] }],
  dropped: [{ bookId: 'book-2', title: '弃读之书', coverUri: null, ratingHalfStars: null, sessions: [{ id: 's2', ordinal: 1, outcome: 'dropped', startedOn: '2026-02-01', endedOn: '2026-02-03' }] }],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useThemedRecapRepository).mockReturnValue(repository as never);
  jest.mocked(useAnnualRecapRepository).mockReturnValue(annualRepository as never);
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  repository.availableYears.mockResolvedValue([2026, 2025]);
  annualRepository.availableYears.mockResolvedValue([2026, 2024]);
  repository.getYear.mockResolvedValue(recap);
});

test('shows all three themed cards and opens a book', async () => {
  const screen = await render(<ThemedRecapPage />);
  await waitFor(() => expect(screen.getByText('主题回顾卡片')).toBeTruthy());
  expect(screen.getByText('今年二刷成功')).toBeTruthy();
  expect(screen.getByText('五星书')).toBeTruthy();
  expect(screen.getByText('弃读书')).toBeTruthy();
  expect(screen.getByText('2024')).toBeTruthy();
  expect(screen.getAllByText('重读之书').length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByText('弃读之书'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/book/[id]', params: { id: 'book-2' } });
});

test('image action appears only for nonempty themes', async () => {
  repository.getYear.mockResolvedValue({ ...recap, dropped: [] });
  const screen = await render(<ThemedRecapPage />);
  await waitFor(() => expect(screen.getByLabelText('制作五星书图片')).toBeTruthy());
  expect(screen.queryByLabelText('制作弃读书图片')).toBeNull();
  await fireEvent.press(screen.getByLabelText('制作五星书图片'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/recap-share', params: { year: '2026', theme: 'fiveStar' } });
});
