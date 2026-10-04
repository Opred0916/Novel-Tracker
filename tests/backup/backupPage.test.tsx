import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import BackupPage from '../../src/app/settings/backup';
import { BackupValidationError } from '../../src/backup/backupValidation';
import { pickBackupFile, shareBackup } from '../../src/backup/backupPlatform';
import { useBackupService, useImageOcr } from '../../src/storage/AppProvider';
import { makeValidManifest } from './backupFixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useFocusEffect: (callback: () => void | (() => void)) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../../src/backup/backupPlatform', () => ({ pickBackupFile: jest.fn(), shareBackup: jest.fn() }));
jest.mock('../../src/storage/AppProvider', () => ({ useBackupService: jest.fn(), useImageOcr: jest.fn() }));

const service = {
  getOverview: jest.fn(), createBackup: jest.fn(), releaseGeneratedBackup: jest.fn(), inspectBackup: jest.fn(),
  restore: jest.fn(), cancelInspection: jest.fn(), cleanupStaleOperations: jest.fn(),
};
const imageOcr = { pause: jest.fn(async () => undefined), resume: jest.fn(), schedule: jest.fn(async () => undefined) };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBackupService).mockReturnValue(service as unknown as ReturnType<typeof useBackupService>);
  jest.mocked(useImageOcr).mockReturnValue(imageOcr as unknown as ReturnType<typeof useImageOcr>);
  service.getOverview.mockResolvedValue({ counts: makeValidManifest().counts, lastGeneratedAt: null });
  service.createBackup.mockResolvedValue({ operationId: 'export-1', uri: 'cache://backup.noveltracker' });
  service.releaseGeneratedBackup.mockResolvedValue(undefined);
  service.inspectBackup.mockResolvedValue({ token: 'secret-token', sourceUri: 'picked', manifest: makeValidManifest(), counts: makeValidManifest().counts, stagingOperationId: 'restore-1' });
  service.restore.mockResolvedValue(undefined);
  service.cancelInspection.mockResolvedValue(undefined);
  jest.mocked(shareBackup).mockResolvedValue(undefined);
  jest.mocked(pickBackupFile).mockResolvedValue('picked.noveltracker');
});

test('shows overview and generates, shares, then removes the temporary backup', async () => {
  const screen = await render(<BackupPage />);
  await waitFor(() => expect(screen.getByText('1 本小说 · 1 条阅读记录 · 1 条摘记 · 1 张图片')).toBeTruthy());
  expect(screen.getByText('尚未生成备份')).toBeTruthy();
  await fireEvent.press(screen.getByText('生成备份'));
  await waitFor(() => expect(shareBackup).toHaveBeenCalledWith('cache://backup.noveltracker'));
  expect(service.releaseGeneratedBackup).toHaveBeenCalledWith('export-1');
  expect(screen.queryByText('已保存到外部')).toBeNull();
});

test('quietly returns when file selection is cancelled', async () => {
  jest.mocked(pickBackupFile).mockResolvedValueOnce(null);
  const screen = await render(<BackupPage />);
  await waitFor(() => expect(screen.getByText('从备份恢复')).toBeTruthy());
  await fireEvent.press(screen.getByText('从备份恢复'));
  expect(service.inspectBackup).not.toHaveBeenCalled();
  expect(screen.queryByText(/失败/)).toBeNull();
});

test('explains when the selected backup uses a newer format', async () => {
  service.inspectBackup.mockRejectedValueOnce(new BackupValidationError('unsupported_version', 'future format'));
  const screen = await render(<BackupPage />);
  await fireEvent.press(screen.getByText('从备份恢复'));
  await waitFor(() => expect(screen.getByText('备份格式版本过新，当前 App 无法读取；原有数据未发生变化。')).toBeTruthy());
});

test('previews counts and only restores after an independent destructive confirmation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    const screen = await render(<BackupPage />);
    await waitFor(() => expect(screen.getByText('从备份恢复')).toBeTruthy());
    await fireEvent.press(screen.getByText('从备份恢复'));
    await waitFor(() => expect(screen.getByText('这会完整替换当前书库')).toBeTruthy());
    expect(screen.getAllByText('1 本小说 · 1 条阅读记录 · 1 条摘记 · 1 张图片')).toHaveLength(2);
    await fireEvent.press(screen.getByText('确认恢复'));
    expect(service.restore).not.toHaveBeenCalled();
    const buttons = alert.mock.calls.at(-1)?.[2];
    await act(async () => { buttons?.find(button => button.style === 'destructive')?.onPress?.(); });
    await waitFor(() => expect(service.restore).toHaveBeenCalledWith('secret-token', expect.any(Function)));
    expect(imageOcr.pause).toHaveBeenCalledTimes(1);
    expect(imageOcr.resume).toHaveBeenCalledTimes(1);
    expect(imageOcr.schedule).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/');
  } finally { alert.mockRestore(); }
});

test('reports validation and restore failures without claiming current data changed', async () => {
  service.inspectBackup.mockRejectedValueOnce(new Error('bad archive'));
  const screen = await render(<BackupPage />);
  await waitFor(() => expect(screen.getByText('从备份恢复')).toBeTruthy());
  await fireEvent.press(screen.getByText('从备份恢复'));
  await waitFor(() => expect(screen.getByText('无法读取这个备份，原有数据未发生变化。')).toBeTruthy());

  service.inspectBackup.mockResolvedValueOnce({ token: 'secret-token', sourceUri: 'picked', manifest: makeValidManifest(), counts: makeValidManifest().counts, stagingOperationId: 'restore-1' });
  service.restore.mockRejectedValueOnce(new Error('db failed'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  try {
    await fireEvent.press(screen.getByText('从备份恢复'));
    await waitFor(() => expect(screen.getByText('确认恢复')).toBeTruthy());
    await fireEvent.press(screen.getByText('确认恢复'));
    const buttons = alert.mock.calls.at(-1)?.[2];
    await act(async () => { buttons?.find(button => button.style === 'destructive')?.onPress?.(); });
    await waitFor(() => expect(screen.getByText('恢复失败，原有数据未发生变化。')).toBeTruthy());
    expect(router.replace).not.toHaveBeenCalled();
  } finally { alert.mockRestore(); }
});

test('cancels an unconfirmed inspection when the page unmounts', async () => {
  const screen = await render(<BackupPage />);
  await waitFor(() => expect(screen.getByText('从备份恢复')).toBeTruthy());
  await fireEvent.press(screen.getByText('从备份恢复'));
  await waitFor(() => expect(screen.getByText('确认恢复')).toBeTruthy());
  expect(service.inspectBackup).toHaveBeenCalledWith('picked.noveltracker', expect.any(Function));
  await act(async () => { screen.unmount(); });
  expect(service.cancelInspection).toHaveBeenCalledWith('secret-token');
});
