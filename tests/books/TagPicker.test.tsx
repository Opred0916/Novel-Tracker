import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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

test('groups tags behind expandable category rows while search reveals matches', async () => {
  const screen = await render(<TagPicker tags={tags} selectedIds={[]} onChange={jest.fn()} searchable grouped collapsible />);
  expect(screen.getByText('背景与世界')).toBeTruthy();
  expect(screen.queryByText('古代')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /展开背景与世界/ }));
  expect(screen.getByText('古代')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('搜索标签'), '悬疑');
  expect(screen.getByText('悬疑')).toBeTruthy();
});

test('compact search initially shows only selected tags and finds others on demand', async () => {
  const screen = await render(<TagPicker tags={tags} selectedIds={['one']} onChange={jest.fn()} searchable showSelectedWhenEmpty />);
  expect(screen.getByText('古代')).toBeTruthy();
  expect(screen.queryByText('悬疑')).toBeNull();
  await fireEvent.changeText(screen.getByPlaceholderText('搜索标签'), '悬疑');
  expect(screen.getByText('悬疑')).toBeTruthy();
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

test('keeps selections made while a new tag is being created', async () => {
  let finishCreate: (tag: Tag) => void = () => {};
  const onCreateTag = () => new Promise<Tag>(resolve => { finishCreate = resolve; });
  const onChange = jest.fn();
  const screen = await render(<TagPicker tags={tags} selectedIds={[]} onChange={onChange} onCreateTag={onCreateTag} />);
  await fireEvent.changeText(screen.getByPlaceholderText('新标签名称'), '赛博朋克');
  let creation: Promise<void> | undefined;
  let fiber = screen.getByRole('button', { name: '添加标签' }).unstable_fiber;
  let createPress: (() => Promise<void>) | undefined;
  while (fiber && !createPress) {
    createPress = fiber.memoizedProps?.onPress as (() => Promise<void>) | undefined;
    fiber = fiber.return;
  }
  expect(createPress).toBeDefined();
  act(() => { creation = createPress!(); });
  await fireEvent.press(screen.getByText('古代'));
  expect(onChange).toHaveBeenCalledWith(['one']);
  await screen.rerender(<TagPicker tags={tags} selectedIds={['one']} onChange={onChange} onCreateTag={onCreateTag} />);
  await act(async () => {
    finishCreate({ id: 'three', name: '赛博朋克', isSystem: false });
    await creation;
  });
  expect(onChange).toHaveBeenLastCalledWith(['one', 'three']);
});
