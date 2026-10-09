import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BookDetail } from '../../src/books/BookDetail';
import type { Book } from '../../src/books/types';

const baseBook: Book = {
  id: 'book-1', title: '长夜', author: null, status: 'want_to_read', protagonists: [], ratingHalfStars: null, bookType: null, tags: [],
  legacyReadCount: 0, coverImageId: null, coverUri: null, createdAt: '2026-09-29T10:00:00.000Z', updatedAt: '2026-09-29T10:00:00.000Z',
  whyWantToRead: null, platform: null,
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
  expect(screen.getAllByText('长夜').length).toBeGreaterThanOrEqual(1);
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
  expect(screen.getByTestId('book-detail-hero')).toBeTruthy();
});

test('shows optional motivation and platform when present', async () => {
  const screen = await render(<BookDetail book={{ ...baseBook, whyWantToRead: '朋友推荐', platform: '晋江文学城' }} />);
  expect(screen.getByText('朋友推荐')).toBeTruthy();
  expect(screen.getByText('晋江文学城')).toBeTruthy();
});

test('shows all reading attempts and an editable undated first read', async () => {
  const onEditReading = jest.fn();
  const screen = await render(<BookDetail book={{ ...baseBook, status: 'dropped', legacyReadCount: 1 }} sessions={[
    { id: 'second', bookId: baseBook.id, ordinal: 2, startedOn: '2026-09-01', endedOn: '2026-09-20', outcome: 'dropped' },
  ]} onEditReading={onEditReading} />);
  expect(screen.getByText('阅读历史')).toBeTruthy();
  expect(screen.getByText(/第 1 次阅读.*日期未记录/)).toBeTruthy();
  expect(screen.getByText(/第 2 次阅读.*弃读/)).toBeTruthy();
  await fireEvent.press(screen.getByText('补记首刷日期'));
  expect(onEditReading).toHaveBeenCalledWith('first');
  await fireEvent.press(screen.getByText('编辑第 2 次阅读'));
  expect(onEditReading).toHaveBeenCalledWith('second');
});
