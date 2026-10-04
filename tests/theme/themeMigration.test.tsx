import React from 'react';
import { render } from '@testing-library/react-native';
import { RatingField } from '../../src/books/RatingField';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#3E627D', rating: '#B77B24', text: '#292D29', border: '#D8D5CD', card: '#FFFFFF', background: '#F6F3EC', mutedText: '#716F68', danger: '#9B3030', primarySoft: '#E9F0F5', primaryPressed: '#35536A', name: '雾蓝' }, themeId: 'mist', setTheme: jest.fn(), saveError: null }),
}));

test('rating controls use the active theme primary while keeping rating semantics', async () => {
  const view = await render(<RatingField value={4} onChange={jest.fn()} allowNewValue />);
  expect(JSON.stringify(view.getByText('2 / 5 星').props.style)).toContain('#B77B24');
  expect(view.getByTestId('rating-slider').props.minimumTrackTintColor).toBe('#3E627D');
});
