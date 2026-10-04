import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import RecapSharePage from '../../src/app/settings/recap-share';
import { useThemedRecapRepository } from '../../src/storage/AppProvider';
import { captureRecapPng, discardRecapPng, saveRecapPng, shareRecapPng } from '../../src/books/recapSharePlatform';

let mockCardReady = true;
jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useLocalSearchParams: jest.fn() }));
jest.mock('../../src/storage/AppProvider', () => ({ useThemedRecapRepository: jest.fn() }));
jest.mock('../../src/books/recapSharePlatform', () => ({ captureRecapPng: jest.fn(), discardRecapPng: jest.fn(), saveRecapPng: jest.fn(), shareRecapPng: jest.fn() }));
jest.mock('../../src/books/RecapShareCard', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return { RecapShareCard: React.forwardRef(({ snapshot, onReady }: { snapshot: { year: number }; onReady(ready: boolean): void }, ref: unknown) => {
    React.useEffect(() => { if (mockCardReady) onReady(true); }, [onReady]);
    return <View ref={ref}><Text>{snapshot.year} 年卡片</Text></View>;
  }) };
});

const repository = { getYear: jest.fn() };
const recap = { year: 2026, rereadSuccess: [], dropped: [], fiveStar: [{ bookId: 'b1', title: '一本书', coverUri: null, ratingHalfStars: 10, sessions: [{ id: 's1', ordinal: 1, outcome: 'finished', startedOn: null, endedOn: '2026-04-01' }] }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockCardReady = true;
  jest.mocked(useLocalSearchParams).mockReturnValue({ year: '2026', theme: 'fiveStar' });
  jest.mocked(useThemedRecapRepository).mockReturnValue(repository as never);
  repository.getYear.mockResolvedValue(recap);
  jest.mocked(captureRecapPng).mockResolvedValue('file:///recap.png');
  jest.mocked(saveRecapPng).mockResolvedValue(undefined);
  jest.mocked(shareRecapPng).mockResolvedValue(undefined);
});

test('buttons remain disabled until card reports its covers ready', async () => {
  mockCardReady = false;
  const screen = await render(<RecapSharePage />);
  await waitFor(() => expect(screen.getByText('2026 年卡片')).toBeTruthy());
  expect(screen.getByLabelText('保存到相册').props.accessibilityState?.disabled).toBe(true);
  await fireEvent.press(screen.getByLabelText('保存到相册'));
  expect(captureRecapPng).not.toHaveBeenCalled();
});

test('rejects invalid route and does not query', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ year: '20x6', theme: 'fiveStar' });
  const screen = await render(<RecapSharePage />);
  expect(screen.getByText('图片参数无效')).toBeTruthy();
  expect(repository.getYear).not.toHaveBeenCalled();
});

test('previews, saves, and shares without claiming delivery', async () => {
  const screen = await render(<RecapSharePage />);
  await waitFor(() => expect(screen.getByText('2026 年卡片')).toBeTruthy());
  await waitFor(() => expect(screen.getByLabelText('保存到相册').props.accessibilityState?.disabled).toBe(false));
  await fireEvent.press(screen.getByLabelText('保存到相册'));
  await waitFor(() => expect(screen.getByText('已保存到相册')).toBeTruthy());
  expect(discardRecapPng).toHaveBeenCalledWith('file:///recap.png');
  await fireEvent.press(screen.getByLabelText('系统分享'));
  await waitFor(() => expect(shareRecapPng).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('发送成功')).toBeNull();
});

test('permission failure leaves independent share action available', async () => {
  jest.mocked(saveRecapPng).mockRejectedValue({ code: 'permission_denied' });
  const screen = await render(<RecapSharePage />);
  await waitFor(() => expect(screen.getByText('2026 年卡片')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('保存到相册'));
  await waitFor(() => expect(screen.getByText('未获得相册写入权限，可以改用系统分享')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('系统分享'));
  await waitFor(() => expect(shareRecapPng).toHaveBeenCalledTimes(1));
});

test('rapid taps capture once and stale captured image is not saved', async () => {
  let resolveCapture!: (uri: string) => void;
  jest.mocked(captureRecapPng).mockImplementation(() => new Promise(resolve => { resolveCapture = resolve; }));
  const screen = await render(<RecapSharePage />);
  await waitFor(() => expect(screen.getByText('2026 年卡片')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('保存到相册'));
  await fireEvent.press(screen.getByLabelText('保存到相册'));
  expect(captureRecapPng).toHaveBeenCalledTimes(1);
  jest.mocked(useLocalSearchParams).mockReturnValue({ year: '2025', theme: 'fiveStar' });
  repository.getYear.mockResolvedValue({ ...recap, year: 2025 });
  await screen.rerender(<RecapSharePage />);
  await waitFor(() => expect(screen.getByText('2025 年卡片')).toBeTruthy());
  resolveCapture('file:///old.png');
  await waitFor(() => expect(discardRecapPng).toHaveBeenCalledWith('file:///old.png'));
  expect(saveRecapPng).not.toHaveBeenCalled();
  expect(screen.getByLabelText('保存到相册').props.accessibilityState?.disabled).toBe(false);
});

test('old year query cannot overwrite a newer year', async () => {
  let resolveOld!: (value: typeof recap) => void;
  repository.getYear.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const screen = await render(<RecapSharePage />);
  jest.mocked(useLocalSearchParams).mockReturnValue({ year: '2025', theme: 'fiveStar' });
  repository.getYear.mockResolvedValue({ ...recap, year: 2025 });
  await screen.rerender(<RecapSharePage />);
  await waitFor(() => expect(screen.getByText('2025 年卡片')).toBeTruthy());
  resolveOld(recap);
  expect(screen.queryByText('2026 年卡片')).toBeNull();
});
