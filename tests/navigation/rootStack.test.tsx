import React from 'react';
import { render } from '@testing-library/react-native';
import RootLayout from '../../src/app/_layout';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  const MockStack = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  MockStack.Screen = ({ name, options }: { name: string; options: { headerBackTitle?: string } }) => <Text>{`${name}:${options.headerBackTitle ?? ''}`}</Text>;
  return { Stack: MockStack };
});
jest.mock('../../src/storage/AppProvider', () => ({ AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('../../src/account/AccountProvider', () => ({ AccountProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, useAccount: () => ({ user: null }) }));
jest.mock('../../src/sync/SyncProvider', () => ({ SyncProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('../../src/theme/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ theme: { background: '#fff', primary: '#28584E', text: '#292D29' } }),
}));

test('book overview returns to management rather than recap', async () => {
  const screen = await render(<RootLayout />);
  expect(screen.getByText('settings/overview:管理')).toBeTruthy();
  expect(screen.queryByText('settings/data:管理')).toBeNull();
});
