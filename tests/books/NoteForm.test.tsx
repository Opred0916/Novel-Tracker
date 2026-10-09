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

test('embedded quick form tracks unsaved text and blocks duplicate save', async () => {
  let finishSave!: () => void;
  repository.createNote.mockImplementationOnce(() => new Promise(resolve => { finishSave = () => resolve({}); }));
  const onSaved = jest.fn();
  const onDirtyChange = jest.fn();
  const view = await render(<NoteForm bookId="book-1" highlights={[]} repository={repository} onSaved={onSaved} onCancel={jest.fn()} embedded autoFocus onDirtyChange={onDirtyChange} />);
  expect(view.queryByText('新增摘记')).toBeNull();
  expect(view.getByPlaceholderText('写下这次阅读的想法').props.autoFocus).toBe(true);
  await fireEvent.changeText(view.getByPlaceholderText('写下这次阅读的想法'), '随手想到的');
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  await fireEvent.press(view.getByText('保存摘记'));
  await fireEvent.press(view.getByText('保存摘记'));
  expect(repository.createNote).toHaveBeenCalledTimes(1);
  finishSave();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(onDirtyChange).toHaveBeenLastCalledWith(false);
});

test('failed note save keeps typed text and permits retry', async () => {
  repository.createNote.mockRejectedValueOnce(new Error('暂时无法保存'));
  const view = await render(<NoteForm bookId="book-1" highlights={[]} repository={repository} onSaved={jest.fn()} onCancel={jest.fn()} embedded />);
  await fireEvent.changeText(view.getByPlaceholderText('写下这次阅读的想法'), '未保存的内容');
  await fireEvent.press(view.getByText('保存摘记'));
  expect(await view.findByText('暂时无法保存')).toBeTruthy();
  expect(view.getByPlaceholderText('写下这次阅读的想法').props.value).toBe('未保存的内容');
  await fireEvent.press(view.getByText('保存摘记'));
  await waitFor(() => expect(repository.createNote).toHaveBeenCalledTimes(2));
});
