import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BookCard } from '../../src/books/BookCard';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#28584E', primarySoft: '#E8F1EC', primaryPressed: '#224B42', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD', mutedText: '#716F68', rating: '#B77B24' } }),
}));

test('uses compact star rating text on a readable card', async () => {
  const view = await render(<BookCard book={{ id: 'book-1', title: '长夜', author: '作者', status: 'finished', protagonists: [], ratingHalfStars: 10, bookType: null, tags: [], legacyReadCount: 0, coverImageId: null, coverUri: null, createdAt: '', updatedAt: '', whyWantToRead: null, platform: null }} onPress={() => undefined} />);
  expect(view.getByText('★ 5.0')).toBeTruthy();
});

test('quick record button does not open the book card', async () => {
  const onPress = jest.fn();
  const onQuickRecord = jest.fn();
  const book = { id: 'book-1', title: '长夜', author: '作者', status: 'reading' as const, protagonists: [], ratingHalfStars: null, bookType: null, tags: [], legacyReadCount: 0, coverImageId: null, coverUri: null, createdAt: '', updatedAt: '', whyWantToRead: null, platform: null };
  const view = await render(<BookCard book={book} onPress={onPress} onQuickRecord={onQuickRecord} />);
  await fireEvent.press(view.getByRole('button', { name: '快捷记录《长夜》' }));
  expect(onQuickRecord).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
});

test('keeps a long title and rating in the flexible details column', async () => {
  const book = { id: 'long', title: '很长很长很长很长的小说名字和续篇', author: '一位名字也非常长的作者', status: 'finished' as const, protagonists: [], ratingHalfStars: 9, bookType: null, tags: [], legacyReadCount: 0, coverImageId: null, coverUri: null, createdAt: '', updatedAt: '', whyWantToRead: null, platform: null };
  const view = await render(<BookCard book={book} onPress={jest.fn()} />);
  expect(view.getAllByText(book.title).some(node => node.props.numberOfLines === 2)).toBe(true);
  expect(view.getByText(book.author).props.numberOfLines).toBe(1);
  expect(view.getByText('★ 4.5')).toBeTruthy();
});
