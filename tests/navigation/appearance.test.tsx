import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import AppearancePage from '../../src/app/settings/appearance';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#28584E', background: '#F6F3EC', text: '#292D29', mutedText: '#716F68', card: '#FFFFFF', border: '#D8D5CD' } }),
}));
jest.mock('../../src/theme/ThemePicker', () => ({ ThemePicker: () => { const { Text: MockText } = require('react-native'); return <MockText>主题颜色</MockText>; } }));

test('keeps appearance settings on their own page', async () => {
  const view = await render(<AppearancePage />);
  expect(view.getByText('外观')).toBeTruthy();
  expect(view.getByText('主题颜色')).toBeTruthy();
});
