import React from 'react';
import { render } from '@testing-library/react-native';
import { HighlightsSection } from '../../src/books/HighlightsSection';

const repository = { listHighlights: jest.fn().mockResolvedValue([]), registerImage: jest.fn(), addHighlights: jest.fn(), removeHighlight: jest.fn() } as any;

test('shows empty highlights state and add action', async () => {
  const screen = await render(<HighlightsSection bookId="book-1" repository={repository} />);
  expect(screen.getByText('精彩片段')).toBeTruthy();
  expect(screen.getByText('添加图片')).toBeTruthy();
  expect(screen.getByText('还没有精彩片段')).toBeTruthy();
});
