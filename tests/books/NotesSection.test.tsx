import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NotesSection } from '../../src/books/NotesSection';

const image = { id: 'image-1', bookId: 'book-1', localPath: 'file:///one.jpg', createdAt: '2026-03-01' };
const note = { id: 'note-1', bookId: 'book-1', body: '我的想法', createdAt: '2026-03-01', updatedAt: '2026-03-01', readingSessionId: null, sourceKind: 'app' as const, originalRecordedOn: null, originalRecordedTime: null, images: [image] };

test('opens an image attached to a note', async () => {
  const repository = { listNotes: jest.fn().mockResolvedValue([note]), deleteNote: jest.fn(), updateNote: jest.fn() } as any;
  const onSelect = jest.fn();
  const screen = await render(<NotesSection bookId="book-1" repository={repository} highlights={[]} onSelect={onSelect} />);
  await waitFor(() => expect(screen.getByLabelText('打开摘记图片')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('打开摘记图片'));
  expect(onSelect).toHaveBeenCalledWith([image]);
});
