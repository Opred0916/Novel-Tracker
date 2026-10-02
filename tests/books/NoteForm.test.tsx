import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NoteForm } from '../../src/books/NoteForm';

const repository = {
  createNote: jest.fn().mockResolvedValue({}),
  updateNote: jest.fn().mockResolvedValue({}),
  registerImage: jest.fn(),
  addHighlights: jest.fn(),
} as any;

beforeEach(() => jest.clearAllMocks());

test('requires a non-blank idea before saving', async () => {
  const view = await render(<NoteForm bookId="book-1" highlights={[]} repository={repository} onSaved={jest.fn()} onCancel={jest.fn()} />);
  await fireEvent.press(view.getByText('保存摘记'));
  expect(await view.findByText('请输入我的想法')).toBeTruthy();
  expect(repository.createNote).not.toHaveBeenCalled();
});

test('saves text without images', async () => {
  const onSaved = jest.fn();
  const view = await render(<NoteForm bookId="book-1" highlights={[]} repository={repository} onSaved={onSaved} onCancel={jest.fn()} />);
  await fireEvent.changeText(view.getByPlaceholderText('写下这次阅读的想法'), '一本书的想法');
  await fireEvent.press(view.getByText('保存摘记'));
  await waitFor(() => expect(repository.createNote).toHaveBeenCalledWith('book-1', { body: '一本书的想法', imageIds: [] }));
  expect(onSaved).toHaveBeenCalled();
});
