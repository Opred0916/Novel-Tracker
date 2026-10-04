import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RandomWantToReadSheet } from '../../src/books/RandomWantToReadSheet';
import type { Book } from '../../src/books/types';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#28584E', primarySoft: '#E8F1EC', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD', mutedText: '#716F68', background: '#F6F3EC', danger: '#9B3030' } }),
}));

const picked: Book = {
  id: 'book-1', title: '长夜', author: '作者', status: 'want_to_read', protagonists: ['阿青'], ratingHalfStars: null, bookType: 'romance_male_male', tags: [{ id: 'tag-1', name: '慢热', isSystem: true }],
  legacyReadCount: 0, coverImageId: null, coverUri: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', whyWantToRead: '朋友推荐', platform: null,
};

test('shows the random pick and opens its detail page', async () => {
  const onOpen = jest.fn();
  const screen = await render(<RandomWantToReadSheet book={picked} candidateCount={3} onOpen={onOpen} onClose={jest.fn()} onPickAgain={jest.fn()} />);
  expect(screen.getByText('随机抽到')).toBeTruthy();
  expect(screen.getAllByText('长夜').length).toBeGreaterThan(0);
  expect(screen.getByText('候选书目 3 本')).toBeTruthy();
  fireEvent.press(screen.getByText('查看小说'));
  expect(onOpen).toHaveBeenCalledWith(picked.id);
});

test('shows an empty state when there is no want-to-read candidate', async () => {
  const screen = await render(<RandomWantToReadSheet book={null} candidateCount={0} onOpen={jest.fn()} onClose={jest.fn()} onPickAgain={jest.fn()} />);
  expect(screen.getByText('暂时没有想读的小说')).toBeTruthy();
});
