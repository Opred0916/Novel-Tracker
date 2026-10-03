import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import OpenExportPage from '../../src/app/settings/export';
import { shareOpenExport } from '../../src/export/openExportPlatform';
import { useOpenExportService } from '../../src/storage/AppProvider';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useFocusEffect: (callback: () => void | (() => void)) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../../src/export/openExportPlatform', () => ({ shareOpenExport: jest.fn() }));
jest.mock('../../src/storage/AppProvider', () => ({ useOpenExportService: jest.fn() }));

const service = {
  getOverview: jest.fn(),
  createExport: jest.fn(),
  releaseExport: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useOpenExportService).mockReturnValue(service as unknown as ReturnType<typeof useOpenExportService>);
  service.getOverview.mockResolvedValue({ books: 2, readingSessions: 3, notes: 4, images: 5 });
  service.createExport.mockResolvedValue({ operationId: 'open-export-1', uri: 'cache://NovelTracker-export.zip' });
  service.releaseExport.mockResolvedValue(undefined);
  jest.mocked(shareOpenExport).mockResolvedValue(undefined);
});

test('shows open export counts and shares then releases the temporary ZIP', async () => {
  const screen = await render(<OpenExportPage />);
  await waitFor(() => expect(screen.getByText('2 本小说 · 3 条阅读记录 · 4 条摘记 · 5 张图片')).toBeTruthy());
  expect(screen.getByText(/不会修改当前书库/)).toBeTruthy();
  await fireEvent.press(screen.getByText('生成并分享'));
  await waitFor(() => expect(shareOpenExport).toHaveBeenCalledWith('cache://NovelTracker-export.zip'));
  expect(service.releaseExport).toHaveBeenCalledWith('open-export-1');
  expect(screen.getByText(/已生成，已打开分享面板/)).toBeTruthy();
});

test('reports a share failure without claiming that the file was saved', async () => {
  jest.mocked(shareOpenExport).mockRejectedValueOnce(new Error('share failed'));
  const screen = await render(<OpenExportPage />);
  await fireEvent.press(screen.getByText('生成并分享'));
  await waitFor(() => expect(screen.getByText('导出或分享失败，当前书库未发生变化。')).toBeTruthy());
  expect(screen.queryByText(/已保存/)).toBeNull();
  expect(service.releaseExport).toHaveBeenCalledWith('open-export-1');
});
