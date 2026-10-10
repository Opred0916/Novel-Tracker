import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import DataSafetyPage from '../../src/app/settings/data-safety';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

test('explains local data, a real external backup, and careful migration', async () => {
  const screen = await render(<DataSafetyPage />);
  expect(screen.getByText(/书库只在当前设备/)).toBeTruthy();
  expect(screen.getByText(/账号书库和图片保存在本机/)).toBeTruthy();
  expect(screen.getByText(/\.noveltracker/)).toBeTruthy();
  expect(screen.getByText(/保存到“文件”或其他设备外/)).toBeTruthy();
  expect(screen.getByText(/确认能找到它/)).toBeTruthy();
  expect(screen.getByText(/Expo Go 与独立安装版不共享书库/)).toBeTruthy();
  expect(screen.getByText(/恢复会替换新版当前书库/)).toBeTruthy();
  expect(screen.getByText(/若新版已有记录，先备份/)).toBeTruthy();
  expect(screen.getByText(/核对小说、阅读历史、摘记和图片/)).toBeTruthy();
  expect(screen.getByText(/再清除旧版数据/)).toBeTruthy();
  expect(screen.getByText(/私人感想和截图/)).toBeTruthy();
  expect(screen.queryByText('已安全备份')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '前往备份与恢复' }));
  expect(router.push).toHaveBeenCalledWith('/settings/backup');
});
