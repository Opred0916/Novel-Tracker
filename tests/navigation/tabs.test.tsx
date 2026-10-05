import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import TabsLayout from '../../src/app/(tabs)/_layout';
import ManageTab from '../../src/app/(tabs)/manage';
import IndexRedirect from '../../src/app/index';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  const Tabs = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  Tabs.Screen = ({ options }: { options: { title: string } }) => <Text>{options.title}</Text>;
  return { Tabs, Redirect: ({ href }: { href: string }) => <Text>{href}</Text>, router: { push: jest.fn() } };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#28584E', primarySoft: '#E8F1EC', primaryPressed: '#224B42', background: '#F6F3EC', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD', mutedText: '#716F68', rating: '#B77B24', danger: '#9B3030', name: '墨绿' }, themeId: 'forest', setTheme: jest.fn(), saveError: null }),
}));

test('defines the three bottom navigation destinations', async () => {
  const view = await render(<TabsLayout />);
  expect(view.getByText('书架')).toBeTruthy();
  expect(view.getByText('回顾')).toBeTruthy();
  expect(view.getByText('管理')).toBeTruthy();
});

test('management groups maintenance tools and theme choices', async () => {
  const view = await render(<ManageTab />);
  expect(view.getByText('快捷标签设置')).toBeTruthy();
  expect(view.getByText('追加旧记录')).toBeTruthy();
  expect(view.getByText('备份与恢复')).toBeTruthy();
  expect(view.getByText('主题颜色')).toBeTruthy();
});

test('root route redirects to the tabs group', async () => {
  const view = await render(<IndexRedirect />);
  expect(view.getByText('/(tabs)')).toBeTruthy();
});
