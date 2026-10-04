import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NotesSection } from '../../src/books/NotesSection';

const repository = { listNotes: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  repository.listNotes.mockResolvedValue([{ id: 'note-1', bookId: 'book-1', body: '正文', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', readingSessionId: null, sourceKind: 'app', originalRecordedOn: null, originalRecordedTime: null, images: [] }]);
});

test('marks the requested note after confirming it belongs to this book', async () => {
  const onFocusResult = jest.fn();
  const screen = await render(<NotesSection bookId="book-1" repository={repository as never} highlights={[]} focusNoteId="note-1" onFocusResult={onFocusResult} />);
  await waitFor(() => expect(screen.getByTestId('note-note-1')).toBeTruthy());
  expect(screen.getByText('正文')).toBeTruthy();
  expect(onFocusResult).toHaveBeenCalledWith(true);
  expect(screen.getByTestId('note-note-1').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ borderColor: '#593f72' })]));
});

test('reports an unknown note without rendering a foreign note', async () => {
  const onFocusResult = jest.fn();
  const screen = await render(<NotesSection bookId="book-1" repository={repository as never} highlights={[]} focusNoteId="missing" onFocusResult={onFocusResult} />);
  await waitFor(() => expect(screen.getByText('正文')).toBeTruthy());
  expect(onFocusResult).toHaveBeenCalledWith(false);
  expect(screen.queryByTestId('note-missing')).toBeNull();
});
