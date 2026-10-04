import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from '../../src/theme/ThemeProvider';

function Consumer() {
  const { theme, themeId, setTheme, saveError } = useTheme();
  return <>
    <Text>{theme.name}</Text>
    <Text>{themeId}</Text>
    <Text>{saveError ?? '无错误'}</Text>
    <Text onPress={() => { void setTheme('mist'); }}>切换雾蓝</Text>
  </>;
}

test('loads a saved theme and persists a new selection', async () => {
  const storage = { getItem: jest.fn().mockResolvedValue('clay'), setItem: jest.fn().mockResolvedValue(undefined) };
  const view = await render(<ThemeProvider storage={storage}><Consumer /></ThemeProvider>);
  await waitFor(() => expect(view.getByText('陶棕')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByText('切换雾蓝')); });
  expect(view.getByText('雾蓝')).toBeTruthy();
  expect(storage.setItem).toHaveBeenCalledWith('novel-tracker.theme.v1', 'mist');
});

test('falls back to forest and reports a save error without blocking the app', async () => {
  const storage = { getItem: jest.fn().mockResolvedValue('invalid'), setItem: jest.fn().mockRejectedValue(new Error('disk full')) };
  const view = await render(<ThemeProvider storage={storage}><Consumer /></ThemeProvider>);
  await waitFor(() => expect(view.getByText('墨绿')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByText('切换雾蓝')); });
  expect(view.getByText('墨绿')).toBeTruthy();
  expect(view.getByText('主题保存失败，请重试')).toBeTruthy();
});
