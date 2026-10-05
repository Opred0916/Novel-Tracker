import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BulkSelectionBar } from '../../src/books/BulkSelectionBar';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#28584E', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD', primarySoft: '#E8F1EC', mutedText: '#716F68' } }),
}));

test('renders a compact selection header and a bottom organize action', async () => {
  const onCancel = jest.fn();
  const onSelectAll = jest.fn();
  const onContinue = jest.fn();
  const view = await render(<BulkSelectionBar selectedCount={2} canSelectAll onCancel={onCancel} onSelectAll={onSelectAll} onContinue={onContinue} />);
  expect(view.getByText('已选 2 本')).toBeTruthy();
  fireEvent.press(view.getByText('取消'));
  fireEvent.press(view.getByText('全选当前结果'));
  fireEvent.press(view.getByText('整理所选'));
  expect(onCancel).toHaveBeenCalled();
  expect(onSelectAll).toHaveBeenCalled();
  expect(onContinue).toHaveBeenCalled();
});
