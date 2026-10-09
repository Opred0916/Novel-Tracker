import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import DataSafetyPage from '../../src/app/settings/data-safety';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

test('explains local data, a real external backup, and careful migration', async () => {
  const screen = await render(<DataSafetyPage />);
  expect(screen.getByText(/记录保存在当前设备/)).toBeTruthy();
  expect(screen.getByText(/\.noveltracker/)).toBeTruthy();
  expect(screen.getByText(/保存到“文件”或其他设备外部的安全位置/)).toBeTruthy();
  expect(screen.getByText(/确认能够在“文件”中找到这份备份/)).toBeTruthy();
  expect(screen.getByText(/Expo Go 和独立安装版不会自动共享书库/)).toBeTruthy();
  expect(screen.getByText(/恢复会完整替换当前书库/)).toBeTruthy();
  expect(screen.getByText(/先备份独立安装版里已有的记录/)).toBeTruthy();
  expect(screen.getByText(/核对小说、阅读历史、摘记和图片/)).toBeTruthy();
  expect(screen.getByText(/确认之前不要清除 Expo Go 中的原记录/)).toBeTruthy();
  expect(screen.getByText(/私人感想和截图/)).toBeTruthy();
  expect(screen.queryByText('已安全备份')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '前往备份与恢复' }));
  expect(router.push).toHaveBeenCalledWith('/settings/backup');
});
