import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BookshelfToolsSheet } from '../../src/books/BookshelfToolsSheet';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: {
    primary: '#28584E', primarySoft: '#E8F1EC', primaryPressed: '#224B42',
    background: '#F6F3EC', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD',
    mutedText: '#716F68', rating: '#B77B24', danger: '#9B3030',
  } }),
}));

const props = {
  visible: true,
  sheet: 'sort' as const,
  sortOptions: [{ value: 'recently_updated' as const, label: '最近修改' }, { value: 'rating_high' as const, label: '评分从高到低' }],
  sortOrder: 'recently_updated' as const,
  bookType: null,
  tags: [{ id: 'ancient', name: '古代', isSystem: true }],
  tagIds: [],
  onSortChange: jest.fn(), onBookTypeChange: jest.fn(), onTagIdsChange: jest.fn(),
  onResetFilters: jest.fn(), onEnterBulk: jest.fn(), onRandomPick: jest.fn(), onClose: jest.fn(),
};

test('shows selected sort option in the bottom sheet and closes after choosing', async () => {
  const view = await render(<BookshelfToolsSheet {...props} />);
  expect(view.getByText('最近修改')).toBeTruthy();
  await fireEvent.press(view.getByText('评分从高到低'));
  expect(props.onSortChange).toHaveBeenCalledWith('rating_high');
});

test('shows filter controls and resets only type and tags', async () => {
  const view = await render(<BookshelfToolsSheet {...props} sheet="filter" bookType="other" tagIds={['ancient']} />);
  expect(view.getByText('全部类型')).toBeTruthy();
  expect(view.getByText('古代')).toBeTruthy();
  await fireEvent.press(view.getByText('重置筛选'));
  expect(props.onResetFilters).toHaveBeenCalled();
});

test('groups all available tags and keeps search available', async () => {
  const view = await render(<BookshelfToolsSheet {...props} sheet="filter" tags={[...props.tags, { id: 'suspense', name: '悬疑', isSystem: true }]} />);
  expect(view.getByText('背景与世界')).toBeTruthy();
  expect(view.getByText('情节与设定')).toBeTruthy();
  expect(view.getByText('古代')).toBeTruthy();
  await fireEvent.changeText(view.getByPlaceholderText('搜索标签'), '悬疑');
  expect(view.getByText('悬疑')).toBeTruthy();
});

test('puts bulk and random actions in the more sheet', async () => {
  const view = await render(<BookshelfToolsSheet {...props} sheet="more" />);
  await fireEvent.press(view.getByText('批量整理'));
  await fireEvent.press(view.getByText('随机想读'));
  expect(props.onEnterBulk).toHaveBeenCalled();
  expect(props.onRandomPick).toHaveBeenCalled();
});
