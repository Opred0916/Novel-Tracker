import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { BookEditForm } from '../../src/books/BookEditForm';
import type { Book } from '../../src/books/types';

const baseBook: Book = {
  id: 'book-1', title: '长夜', author: null, status: 'want_to_read', protagonists: [], ratingHalfStars: null,
  createdAt: '2026-09-29T10:00:00.000Z', updatedAt: '2026-09-29T10:00:00.000Z',
};

test('starts with two blank protagonist inputs when the book has none', async () => {
  const screen = await render(<BookEditForm book={baseBook} onSave={async () => {}} />);
  expect(screen.getAllByPlaceholderText('主角名字')).toHaveLength(2);
  expect(screen.getByDisplayValue('长夜')).toBeTruthy();
});

test('shows every existing protagonist when there are more than two', async () => {
  const book = { ...baseBook, protagonists: ['阿青', '李四', '王五'] };
  const screen = await render(<BookEditForm book={book} onSave={async () => {}} />);
  expect(screen.getAllByPlaceholderText('主角名字')).toHaveLength(3);
  expect(screen.getByDisplayValue('王五')).toBeTruthy();
});

test('adds another protagonist and sends trimmed, ordered names with the chosen status', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<BookEditForm book={baseBook} onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('作者名字'), ' 某作者 ');
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[0], ' 阿青 ');
  await fireEvent.press(screen.getByText('＋ 添加主角'));
  expect(screen.getAllByPlaceholderText('主角名字')).toHaveLength(3);
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[2], ' 王五 ');
  await fireEvent.press(screen.getByText('在读'));
  await fireEvent.press(screen.getByText('保存修改'));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith({
    title: '长夜', author: '某作者', status: 'reading', protagonists: ['阿青', '王五'],
  }));
});

test('keeps the form open and shows an error for a blank title', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<BookEditForm book={baseBook} onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '   ');
  await fireEvent.press(screen.getByText('保存修改'));
  expect(screen.getByText('请输入书名')).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();
});

test('retains entered values after save failure and allows retry', async () => {
  const onSave = jest.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);
  const screen = await render(<BookEditForm book={baseBook} onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '新长夜');
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[0], '阿青');
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(screen.getByText('保存失败，请重试')).toBeTruthy());
  expect(screen.getByDisplayValue('新长夜')).toBeTruthy();
  expect(screen.getByDisplayValue('阿青')).toBeTruthy();

  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
});
