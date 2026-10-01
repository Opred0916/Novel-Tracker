import React from 'react';
import { render } from '@testing-library/react-native';
import { BookDetail } from '../../src/books/BookDetail';
import type { Book } from '../../src/books/types';

const baseBook: Book = {
  id: 'book-1', title: '长夜', author: null, status: 'want_to_read', protagonists: [], ratingHalfStars: null, bookType: null, tags: [],
  createdAt: '2026-09-29T10:00:00.000Z', updatedAt: '2026-09-29T10:00:00.000Z',
};

test('shows selected work type and custom tags', async () => {
  const book: Book = { ...baseBook, bookType: 'other', tags: [{ id: 'custom', name: '赛博朋克', isSystem: false }] };
  const screen = await render(<BookDetail book={book} />);
  expect(screen.getByText('其他')).toBeTruthy();
  expect(screen.getByText('赛博朋克')).toBeTruthy();
});

test('shows author, actual status and every protagonist', async () => {
  const book: Book = { ...baseBook, author: '某作者', status: 'reading', protagonists: ['阿青', '王五'] };
  const screen = await render(<BookDetail book={book} />);
  expect(screen.getByText('长夜')).toBeTruthy();
  expect(screen.getByText('某作者')).toBeTruthy();
  expect(screen.getByText('在读')).toBeTruthy();
  expect(screen.getByText('阿青')).toBeTruthy();
  expect(screen.getByText('王五')).toBeTruthy();
});

test('explains when optional details have not been entered', async () => {
  const screen = await render(<BookDetail book={baseBook} />);
  expect(screen.getByText('未填写作者')).toBeTruthy();
  expect(screen.getByText('还没有记录主角')).toBeTruthy();
  expect(screen.getByText('未评分')).toBeTruthy();
});

test('shows the overall rating even when the book is now being reread', async () => {
  const screen = await render(<BookDetail book={{ ...baseBook, status: 'reading', ratingHalfStars: 9 }} />);
  expect(screen.getByText('4.5 / 5 星')).toBeTruthy();
});
