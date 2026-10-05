import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BookshelfToolbar } from '../../src/books/BookshelfToolbar';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#28584E', primarySoft: '#E8F1EC', primaryPressed: '#224B42', background: '#F6F3EC', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD', mutedText: '#716F68', rating: '#B77B24', danger: '#9B3030' }, themeId: 'forest', setTheme: jest.fn(), saveError: null }),
}));

const baseProps = {
  status: null as null,
  statusCounts: { all: 8, want_to_read: 1, reading: 2, finished: 4, dropped: 1 },
  onStatusChange: jest.fn(),
  query: '',
  onQueryChange: jest.fn(),
  onClearQuery: jest.fn(),
  sortLabel: '最近修改',
  activeSheet: null,
  onOpenSheet: jest.fn(),
  activeFilterCount: 0,
};

test('keeps all five status options in one horizontal strip', async () => {
  const view = await render(<BookshelfToolbar {...baseProps} />);
  expect(view.getByTestId('status-strip').props.horizontal).toBe(true);
  expect(view.getByRole('radio', { name: '全部 8 本' })).toBeTruthy();
  expect(view.getByRole('radio', { name: '读完 4 本' })).toBeTruthy();
});

test('shows query clear control only when a keyword exists', async () => {
  const view = await render(<BookshelfToolbar {...baseProps} />);
  expect(view.queryByLabelText('清除搜索')).toBeNull();
  await view.rerender(<BookshelfToolbar {...baseProps} query="长夜" />);
  expect(view.getByLabelText('清除搜索')).toBeTruthy();
  fireEvent.press(view.getByLabelText('清除搜索'));
  expect(baseProps.onClearQuery).toHaveBeenCalled();
});

test('opens the three compact tool sheets', async () => {
  const view = await render(<BookshelfToolbar {...baseProps} />);
  await fireEvent.press(view.getByText('排序：最近修改'));
  await fireEvent.press(view.getByText('筛选'));
  await fireEvent.press(view.getByText('更多'));
  expect(baseProps.onOpenSheet).toHaveBeenCalledWith('sort');
  expect(baseProps.onOpenSheet).toHaveBeenCalledWith('filter');
  expect(baseProps.onOpenSheet).toHaveBeenCalledWith('more');
});
