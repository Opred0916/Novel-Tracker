import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
  expect(screen.getByTestId('note-note-1').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ borderColor: '#28584E' })]));
  fireEvent(screen.getByTestId('note-note-1'), 'layout', { nativeEvent: { layout: { y: 42 } } });
  expect(onFocusResult).toHaveBeenCalledWith(true, 42);
});
test('reports an unknown note without rendering a foreign note', async () => {
  const onFocusResult = jest.fn();
  const screen = await render(<NotesSection bookId="book-1" repository={repository as never} highlights={[]} focusNoteId="missing" onFocusResult={onFocusResult} />);
  await waitFor(() => expect(screen.getByText('正文')).toBeTruthy());
  expect(onFocusResult).toHaveBeenCalledWith(false);
  expect(screen.queryByTestId('note-missing')).toBeNull();
});

test('keeps note image selection available while focusing a note', async () => {
  const image = { id: 'image-1', bookId: 'book-1', localPath: 'file:///image-1.jpg', createdAt: '2026-10-01' };
  repository.listNotes.mockResolvedValue([{ id: 'note-1', bookId: 'book-1', body: '带图正文', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', readingSessionId: null, sourceKind: 'app', originalRecordedOn: null, originalRecordedTime: null, images: [image] }]);
  const onSelect = jest.fn();
  const screen = await render(<NotesSection bookId="book-1" repository={repository as never} highlights={[]} onSelect={onSelect} />);
  await waitFor(() => expect(screen.getByLabelText('打开摘记图片')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('打开摘记图片'));
  expect(onSelect).toHaveBeenCalledWith([image]);
});

test('shows the actual reading ordinal for a linked note and keeps unknown links unassigned', async () => {
  const base = { id: 'note-1', bookId: 'book-1', body: '二刷想法', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', readingSessionId: 'session-2', sourceKind: 'app', originalRecordedOn: null, originalRecordedTime: null, images: [] };
  repository.listNotes.mockResolvedValue([base, { ...base, id: 'note-2', body: '无法对应', readingSessionId: 'removed-session' }]);
  const screen = await render(<NotesSection bookId="book-1" repository={repository as never} highlights={[]} sessions={[{ id: 'session-2', bookId: 'book-1', ordinal: 2, startedOn: '2026-09-01', endedOn: '2026-09-10', outcome: 'finished' }]} />);

  expect(screen.getByText(/第 2 次阅读后/)).toBeTruthy();
  expect(screen.getByText(/未关联到具体阅读次数/)).toBeTruthy();
  expect(screen.queryByText(/已关联阅读次数/)).toBeNull();
});
