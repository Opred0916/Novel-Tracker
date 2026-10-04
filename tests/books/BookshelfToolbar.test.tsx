import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BookshelfToolbar } from '../../src/books/BookshelfToolbar';
import type { BookSortOrder } from '../../src/books/bookSearch';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#28584E', primarySoft: '#E8F1EC', primaryPressed: '#224B42', background: '#F6F3EC', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD', mutedText: '#716F68', rating: '#B77B24', danger: '#9B3030' }, themeId: 'forest', setTheme: jest.fn(), saveError: null }),
}));

const baseProps = {
  status: null as null,
  statusCounts: { all: 8, want_to_read: 1, reading: 2, finished: 4, dropped: 1 },
  onStatusChange: jest.fn(),
  query: '',
  onQueryChange: jest.fn(),
  sortLabel: '最近修改',
  sortOptions: [{ value: 'recently_updated', label: '最近修改' }, { value: 'recently_finished', label: '最近读完' }] as { value: BookSortOrder; label: string }[],
  sortOrder: 'recently_updated' as const,
  showSortOptions: false,
  onToggleSort: jest.fn(),
  onSortChange: jest.fn(),
  activeFilterCount: 0,
  hasConditions: false,
  onClearFilters: jest.fn(),
  onToggleFilters: jest.fn(),
  onEnterBulk: jest.fn(),
  bulkMode: false,
};

test('keeps all five status options in one horizontal strip', async () => {
  const view = await render(<BookshelfToolbar {...baseProps} />);
  expect(view.getByTestId('status-strip').props.horizontal).toBe(true);
  expect(view.getByRole('radio', { name: '全部 8 本' })).toBeTruthy();
  expect(view.getByRole('radio', { name: '读完 4 本' })).toBeTruthy();
});

test('hides clear filters until a condition is active', async () => {
  const view = await render(<BookshelfToolbar {...baseProps} />);
  expect(view.queryByText('清除筛选')).toBeNull();
  await view.rerender(<BookshelfToolbar {...baseProps} hasConditions activeFilterCount={1} />);
  expect(view.getByText('清除筛选')).toBeTruthy();
  fireEvent.press(view.getByText('清除筛选'));
  expect(baseProps.onClearFilters).toHaveBeenCalled();
});
