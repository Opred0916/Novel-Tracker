import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { QuickRecordSheet } from '../../src/books/QuickRecordSheet';
import type { Book } from '../../src/books/types';

const book: Book = { id: 'book-1', title: '长夜', author: '作者', status: 'reading', protagonists: [], ratingHalfStars: 7, bookType: null, tags: [], legacyReadCount: 0, coverImageId: null, coverUri: null, createdAt: '', updatedAt: '', whyWantToRead: null, platform: null };
const books = { get: jest.fn().mockResolvedValue(book), endReading: jest.fn().mockResolvedValue({ ...book, status: 'finished' }) };
const history = { list: jest.fn().mockResolvedValue([{ id: 's1', bookId: 'book-1', ordinal: 1, startedOn: '2026-09-01', endedOn: null, outcome: 'reading' }]) };
const notes = { listHighlights: jest.fn().mockResolvedValue([]), createNote: jest.fn().mockResolvedValue({}), updateNote: jest.fn(), registerImage: jest.fn(), addHighlights: jest.fn() };
const onChanged = jest.fn();
const onClose = jest.fn();
const props = { visible: true, bookId: 'book-1', books, history, notes, onChanged, onClose };

beforeEach(() => { jest.clearAllMocks(); books.get.mockResolvedValue(book); history.list.mockResolvedValue([{ id: 's1', bookId: 'book-1', ordinal: 1, startedOn: '2026-09-01', endedOn: null, outcome: 'reading' }]); });

test('loads reading book and offers three independent quick actions', async () => {
  const view = await render(<QuickRecordSheet {...props} />);
  await waitFor(() => expect(view.getByText('写想法')).toBeTruthy());
  expect(view.getByText('标记读完')).toBeTruthy();
  expect(view.getByText('标记弃读')).toBeTruthy();
  expect(view.getByText('作者')).toBeTruthy();
  expect(books.get).toHaveBeenCalledWith('book-1');
});

test('saves a thought without ending reading', async () => {
  const view = await render(<QuickRecordSheet {...props} />);
  await fireEvent.press(await view.findByText('写想法'));
  await fireEvent.changeText(view.getByPlaceholderText('写下这次阅读的想法'), '读到这里想到');
  await fireEvent.press(view.getByText('保存摘记'));
  await waitFor(() => expect(onChanged).toHaveBeenCalledWith('note_saved'));
  expect(books.endReading).not.toHaveBeenCalled();
  expect(view.getByText('想法已保存')).toBeTruthy();
});

test('finishes the active session with its start date and optional rating', async () => {
  const view = await render(<QuickRecordSheet {...props} />);
  await fireEvent.press(await view.findByText('标记读完'));
  expect(view.getByText('2026-09-01')).toBeTruthy();
  await fireEvent.press(view.getByText('确认读完'));
  await waitFor(() => expect(books.endReading).toHaveBeenCalledWith('book-1', expect.objectContaining({ outcome: 'finished', startedOn: '2026-09-01', ratingHalfStars: 7 })));
  expect(onChanged).toHaveBeenCalledWith('finished');
});

test('drop has no rating control and guards unsaved close', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = await render(<QuickRecordSheet {...props} />);
  await fireEvent.press(await view.findByText('标记弃读'));
  expect(view.queryByText('总体评分')).toBeNull();
  await fireEvent.press(view.getByLabelText('关闭快捷记录'));
  expect(alert).toHaveBeenCalledWith('放弃未保存内容？', expect.any(String), expect.any(Array));
  alert.mockRestore();
});

test('rejects an out-of-date book and cannot create a finish record', async () => {
  books.get.mockResolvedValueOnce({ ...book, status: 'finished' });
  const view = await render(<QuickRecordSheet {...props} />);
  expect(await view.findByText('这本书的阅读状态已变化，请返回书架刷新。')).toBeTruthy();
  expect(view.queryByText('标记读完')).toBeNull();
  expect(books.endReading).not.toHaveBeenCalled();
});

test('blocks duplicate finish while an end-reading request is pending', async () => {
  let finish!: () => void;
  books.endReading.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ ...book, status: 'finished' }); }));
  const view = await render(<QuickRecordSheet {...props} />);
  await fireEvent.press(await view.findByText('标记读完'));
  await fireEvent.press(view.getByText('确认读完'));
  await fireEvent.press(view.getByText('确认读完'));
  expect(books.endReading).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() => expect(onChanged).toHaveBeenCalledWith('finished'));
});
