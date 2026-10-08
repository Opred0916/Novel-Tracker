import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AnnualStoryPager } from '../../src/books/AnnualStoryPager';
import type { AnnualStorySummary } from '../../src/books/annualSummaryRepository';

jest.mock('../../src/books/AnnualStoryPageView', () => ({
  AnnualStoryPageView: ({ page }: { page: { id: string } }) => {
    const { Text } = require('react-native');
    return <Text>页面 {page.id}</Text>;
  },
}));

const summary = {
  year: 2026, booksReadCount: 1, books: [], coverBooks: [], firstBook: null, lastBook: null,
  months: [], peakMonths: [], topTags: [], topBookTypes: [], topAuthors: [], highestRatingHalfStars: null,
  topRatedBooks: [], fiveStarBookCount: 0, thoughtCount: 0, thoughtBookCount: 0, thoughtImageCount: 0,
  currentHighlightCount: 0, mostThoughtBooks: [], rereadBooks: [], representativeBooks: [],
} as AnnualStorySummary;

test('pages_horizontally_and_updates_progress_without_a_timer', async () => {
  const pages = [{ id: 'cover' as const }, { id: 'books' as const }, { id: 'share' as const }];
  const screen = await render(<AnnualStoryPager summary={summary} pages={pages} onOpenBook={jest.fn()} />);
  const list = screen.getByTestId('annual-story-list');
  expect(list.props.horizontal).toBe(true);
  expect(list.props.pagingEnabled).toBe(true);
  expect(list.props.keyExtractor(pages[1])).toBe('books');
  expect(screen.getByText('1 / 3')).toBeTruthy();
  await fireEvent(list, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 10000 } } });
  expect(screen.getByText('3 / 3')).toBeTruthy();
  expect(screen.getByRole('button', { name: '下一页' }).props.accessibilityState).toEqual({ disabled: true });
});

test('previous_and_next_buttons_respect_boundaries', async () => {
  const pages = [{ id: 'cover' as const }, { id: 'books' as const }];
  const screen = await render(<AnnualStoryPager summary={summary} pages={pages} onOpenBook={jest.fn()} />);
  expect(screen.getByRole('button', { name: '上一页' }).props.accessibilityState).toEqual({ disabled: true });
  await fireEvent.press(screen.getByRole('button', { name: '下一页' }));
  expect(screen.getByText('2 / 2')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '上一页' }));
  expect(screen.getByText('1 / 2')).toBeTruthy();
});

test('resets_to_cover_when_the_summary_year_changes', async () => {
  const pages = [{ id: 'cover' as const }, { id: 'books' as const }];
  const screen = await render(<AnnualStoryPager summary={summary} pages={pages} onOpenBook={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: '下一页' }));
  expect(screen.getByText('2 / 2')).toBeTruthy();
  await screen.rerender(<AnnualStoryPager summary={{ ...summary, year: 2025 }} pages={pages} onOpenBook={jest.fn()} />);
  expect(screen.getByText('1 / 2')).toBeTruthy();
});
