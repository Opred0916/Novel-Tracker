import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import ManageTab from '../../src/app/(tabs)/manage';
import { useBackupService } from '../../src/storage/AppProvider';
import { dataSafetyPreferences } from '../../src/dataSafety/preferences';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => require('react').useEffect(callback, [callback]),
  router: { push: jest.fn() },
}));
jest.mock('../../src/storage/AppProvider', () => ({ useBackupService: jest.fn() }));
jest.mock('../../src/dataSafety/preferences', () => ({ dataSafetyPreferences: { read: jest.fn(), mark: jest.fn() } }));

const counts = { books: 1, protagonists: 0, tags: 0, bookTags: 0, quickTags: 0, readingSessions: 0, notes: 0, noteImages: 0, highlightImages: 0, images: 0 };
const service = { getOverview: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBackupService).mockReturnValue(service as unknown as ReturnType<typeof useBackupService>);
  service.getOverview.mockResolvedValue({ counts, lastGeneratedAt: null });
  jest.mocked(dataSafetyPreferences.read).mockResolvedValue(false);
  jest.mocked(dataSafetyPreferences.mark).mockResolvedValue(undefined);
});

test('populated unbacked library offers a one-time path to backup', async () => {
  const screen = await render(<ManageTab />);
  await waitFor(() => expect(screen.getByText(/书库已有记录/)).toBeTruthy());
  expect(screen.getByText(/保存到“文件”/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '去备份' }));
  expect(screen.queryByText(/书库已有记录/)).toBeNull();
  expect(dataSafetyPreferences.mark).toHaveBeenCalledWith('backupReminderHandled');
  expect(router.push).toHaveBeenCalledWith('/settings/backup');
});

test('dismissing the reminder does not navigate or hide management tools', async () => {
  const screen = await render(<ManageTab />);
  await waitFor(() => expect(screen.getByRole('button', { name: '暂不提醒' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '暂不提醒' }));
  expect(screen.queryByText(/书库已有记录/)).toBeNull();
  expect(screen.getByText('备份与恢复')).toBeTruthy();
  expect(router.push).not.toHaveBeenCalled();
});

test('keeps a permanent path to backup without a redundant guide', async () => {
  const screen = await render(<ManageTab />);
  expect(screen.getByTestId('tab-page-header')).toBeTruthy();
  expect(screen.getByText('书库维护')).toBeTruthy();
  expect(screen.queryByText('使用与数据安全')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '备份与恢复' }));
  expect(router.push).toHaveBeenCalledWith('/settings/backup');
});

test('shows import, export and backup only once without a duplicate data-management menu', async () => {
  const screen = await render(<ManageTab />);
  expect(screen.queryByText('数据管理')).toBeNull();
  expect(screen.getAllByText('追加旧记录')).toHaveLength(1);
  expect(screen.getAllByText('导出开放格式')).toHaveLength(1);
  expect(screen.getAllByText('备份与恢复')).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: '导出开放格式' }));
  expect(router.push).toHaveBeenCalledWith('/settings/export');
});

test.each([
  [{ ...counts, books: 0 }, null, false],
  [counts, '2026-10-09T08:00:00Z', false],
  [counts, null, true],
] as const)('no reminder for empty, generated or already handled cases', async (nextCounts, lastGeneratedAt, handled) => {
  service.getOverview.mockResolvedValue({ counts: nextCounts, lastGeneratedAt });
  jest.mocked(dataSafetyPreferences.read).mockResolvedValue(handled);
  const screen = await render(<ManageTab />);
  await waitFor(() => expect(service.getOverview).toHaveBeenCalled());
  expect(screen.queryByText(/书库已有记录/)).toBeNull();
});

test.each(['overview', 'preference'] as const)('%s failure never blocks the management menu', async failure => {
  if (failure === 'overview') service.getOverview.mockRejectedValueOnce(new Error('offline'));
  else jest.mocked(dataSafetyPreferences.read).mockRejectedValueOnce(new Error('storage'));
  const screen = await render(<ManageTab />);
  await waitFor(() => expect(service.getOverview).toHaveBeenCalled());
  expect(screen.queryByText(/书库已有记录/)).toBeNull();
  expect(screen.getByText('备份与恢复')).toBeTruthy();
});

test('a late overview response after unmount does not navigate or mark a prompt', async () => {
  let resolveOverview!: (value: unknown) => void;
  service.getOverview.mockReturnValueOnce(new Promise(resolve => { resolveOverview = resolve; }));
  const screen = await render(<ManageTab />);
  await act(async () => { screen.unmount(); resolveOverview({ counts, lastGeneratedAt: null }); });
  expect(dataSafetyPreferences.mark).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});
