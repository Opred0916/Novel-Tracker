import React from 'react';
import { render } from '@testing-library/react-native';
import { BookCard } from '../../src/books/BookCard';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#28584E', primarySoft: '#E8F1EC', primaryPressed: '#224B42', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD', mutedText: '#716F68', rating: '#B77B24' } }),
}));

test('uses compact star rating text on a readable card', async () => {
  const view = await render(<BookCard book={{ id: 'book-1', title: '长夜', author: '作者', status: 'finished', protagonists: [], ratingHalfStars: 10, bookType: null, tags: [], legacyReadCount: 0, coverImageId: null, coverUri: null, createdAt: '', updatedAt: '', whyWantToRead: null, platform: null }} onPress={() => undefined} />);
  expect(view.getByText('★ 5.0')).toBeTruthy();
});
