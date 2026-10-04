import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { HighlightsSection } from '../../src/books/HighlightsSection';

const repository = { listHighlights: jest.fn().mockResolvedValue([]), registerImage: jest.fn(), addHighlights: jest.fn(), removeHighlight: jest.fn() } as any;

test('shows empty highlights state and add action', async () => {
  const screen = await render(<HighlightsSection bookId="book-1" repository={repository} />);
  expect(screen.getByText('精彩片段')).toBeTruthy();
  expect(screen.getByText('添加图片')).toBeTruthy();
  expect(screen.getByText('还没有精彩片段')).toBeTruthy();
});

test('opens a saved highlight image', async () => {
  const image = { id: 'image-1', bookId: 'book-1', localPath: 'file:///one.jpg', createdAt: '2026-03-01' };
  repository.listHighlights.mockResolvedValueOnce([image]);
  const onSelect = jest.fn();
  const screen = await render(<HighlightsSection bookId="book-1" repository={repository} onSelect={onSelect} />);
  await waitFor(() => expect(screen.getByLabelText('打开精彩片段图片')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('打开精彩片段图片'));
  expect(onSelect).toHaveBeenCalledWith([image]);
});
