import React from 'react';
import { render } from '@testing-library/react-native';
import { BookCover } from '../../src/books/BookCover';

test('renders a readable title-only cover without the old brand mark', async () => {
  const view = await render(<BookCover title="一个很长很长的小说名字" bookId="book-1" size="small" />);
  expect(view.getByLabelText('一个很长很长的小说名字默认封面')).toBeTruthy();
  expect(view.getByText('一个很长很长的小说名字')).toBeTruthy();
  expect(view.queryByText('NOVEL TRACKER')).toBeNull();
});

test('keeps a provided image instead of drawing a default cover', async () => {
  const view = await render(<BookCover title="长夜" bookId="book-1" uri="https://example.com/cover.jpg" />);
  expect(view.getByLabelText('长夜封面')).toBeTruthy();
  expect(view.queryByText('NOVEL TRACKER')).toBeNull();
});
