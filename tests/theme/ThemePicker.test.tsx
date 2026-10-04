import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemePicker } from '../../src/theme/ThemePicker';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

test('shows all eight named theme choices and the selected marker', async () => {
  const storage = { getItem: jest.fn().mockResolvedValue('forest'), setItem: jest.fn().mockResolvedValue(undefined) };
  const view = await render(<ThemeProvider storage={storage}><ThemePicker /><Text>页面</Text></ThemeProvider>);
  await waitFor(() => expect(view.getByText('墨绿')).toBeTruthy());
  expect(view.getByText('雾蓝')).toBeTruthy();
  expect(view.getByText('陶棕')).toBeTruthy();
  expect(view.getByText('石榴红')).toBeTruthy();
  expect(view.getByText('橄榄')).toBeTruthy();
  expect(view.getByText('石墨')).toBeTruthy();
  expect(view.getByText('深海青')).toBeTruthy();
  expect(view.getByText('琥珀')).toBeTruthy();
  expect(view.getByText('✓ 已选')).toBeTruthy();
});
