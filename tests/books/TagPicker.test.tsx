import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TagPicker } from '../../src/books/TagPicker';
import type { Tag } from '../../src/books/types';

const tags: Tag[] = [
  { id: 'one', name: '古代', isSystem: true },
  { id: 'two', name: '悬疑', isSystem: true },
];

test('searches and selects from full tag list', async () => {
  const onChange = jest.fn();
  const screen = await render(<TagPicker tags={tags} selectedIds={['one']} onChange={onChange} searchable />);
  await fireEvent.changeText(screen.getByPlaceholderText('搜索标签'), '悬疑');
  expect(screen.queryByText('古代')).toBeNull();
  await fireEvent.press(screen.getByText('悬疑'));
  expect(onChange).toHaveBeenCalledWith(['one', 'two']);
});

test('creates a custom tag and adds it to selection', async () => {
  const onChange = jest.fn();
  const onCreateTag = jest.fn().mockResolvedValue({ id: 'three', name: '赛博朋克', isSystem: false });
  const screen = await render(<TagPicker tags={tags} selectedIds={[]} onChange={onChange} searchable onCreateTag={onCreateTag} />);
  await fireEvent.changeText(screen.getByPlaceholderText('新标签名称'), ' 赛博朋克 ');
  await fireEvent.press(screen.getByText('添加标签'));
  await waitFor(() => expect(onCreateTag).toHaveBeenCalledWith('赛博朋克'));
  expect(onChange).toHaveBeenCalledWith(['three']);
});
