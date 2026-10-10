import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemePicker } from '../../src/theme/ThemePicker';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

test('shows all theme choices directly without a second sheet', async () => {
  const storage = { getItem: jest.fn().mockResolvedValue('forest'), setItem: jest.fn().mockResolvedValue(undefined) };
  const view = await render(<ThemeProvider storage={storage}><ThemePicker /><Text>页面</Text></ThemeProvider>);
  await waitFor(() => expect(view.getByText('墨绿')).toBeTruthy());
  expect(view.queryByRole('button', { name: '选择主题颜色' })).toBeNull();
  expect(view.getByText('雾蓝')).toBeTruthy();
  expect(view.getByText('陶棕')).toBeTruthy();
  expect(view.getByText('石榴红')).toBeTruthy();
  expect(view.getByText('橄榄')).toBeTruthy();
  expect(view.getByText('石墨')).toBeTruthy();
  expect(view.getByText('深海青')).toBeTruthy();
  expect(view.getByText('琥珀')).toBeTruthy();
  expect(view.getByText('✓ 已选')).toBeTruthy();
});
