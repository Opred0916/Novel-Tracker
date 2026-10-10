import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { BulkOrganizePanel } from '../../src/books/BulkOrganizePanel';
import type { BulkOrganizePreview } from '../../src/books/bulkOrganize';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'new-tag-id') }));

const tags = [
  { id: 'ancient', name: '古代', isSystem: true },
  { id: 'modern', name: '现代', isSystem: true },
];
const selectedBooks = new Map([
  ['book-a', { title: '甲书', author: '作者甲' }],
  ['book-b', { title: '乙书', author: null }],
]);
const preview: BulkOrganizePreview = {
  draft: { addTagIds: ['ancient'], removeTagIds: [], newTags: [], typeChange: { kind: 'set', value: 'other' } },
  items: [
    { before: { id: 'book-a', title: '甲书', author: '作者甲', updatedAt: 'a', bookType: null, tagIds: [] }, after: { bookType: 'other', tagIds: ['ancient'] }, addedTagIds: ['ancient'], removedTagIds: [], typeChanged: true, changed: true },
    { before: { id: 'book-b', title: '乙书', author: null, updatedAt: 'b', bookType: null, tagIds: [] }, after: { bookType: 'other', tagIds: ['ancient'] }, addedTagIds: ['ancient'], removedTagIds: [], typeChanged: true, changed: true },
  ],
  selectedCount: 2, changedCount: 2, unchangedCount: 0, addAffectedBookCount: 2, removeAffectedBookCount: 0, typeAffectedBookCount: 2,
};

test('keeps its heading below the top safe area', async () => {
  const repository = { preview: jest.fn(), apply: jest.fn() };
  const view = await render(<SafeAreaInsetsContext.Provider value={{ top: 54, right: 0, bottom: 34, left: 0 }}><BulkOrganizePanel selectedBooks={selectedBooks} tags={tags} repository={repository as never} onComplete={jest.fn()} onCancel={jest.fn()} /></SafeAreaInsetsContext.Provider>);
  expect(view.getByTestId('bulk-organize-scroll').props.contentContainerStyle.paddingTop).toBeGreaterThanOrEqual(54);
});

async function setup(overrides: Partial<{ preview: BulkOrganizePreview; apply: jest.Mock }> = {}) {
  const repository = { preview: jest.fn().mockResolvedValue(overrides.preview ?? preview), apply: overrides.apply ?? jest.fn().mockResolvedValue({ changedCount: 2 }) };
  const onComplete = jest.fn();
  const onCancel = jest.fn();
  const view = await render(<BulkOrganizePanel selectedBooks={selectedBooks} tags={tags} repository={repository as never} onComplete={onComplete} onCancel={onCancel} />);
  return { repository, onComplete, onCancel, view };
}

test('builds a preview for tag and type operations and shows each book before and after', async () => {
  const { repository, view } = await setup();
  await fireEvent.press(view.getAllByRole('button', { name: /展开背景与世界/ })[0]);
  await fireEvent.press(view.getAllByRole('checkbox')[0]);
  await fireEvent.press(view.getByText('其他'));
  await fireEvent.press(view.getByText('生成预览'));
  await waitFor(() => expect(repository.preview).toHaveBeenCalledWith(['book-a', 'book-b'], expect.objectContaining({ addTagIds: ['ancient'], typeChange: { kind: 'set', value: 'other' } })));
  expect(view.getByText('实际会变化 2 本')).toBeTruthy();
  expect(view.getByText('甲书 · 作者甲')).toBeTruthy();
  expect(view.getByText('乙书')).toBeTruthy();
  expect(view.getByText('确认修改')).toBeTruthy();
});

test('keeps custom tags in the draft until a successful confirmation', async () => {
  const { repository, view } = await setup();
  await fireEvent.changeText(view.getByPlaceholderText('新标签名称'), '赛博朋克');
  await fireEvent.press(view.getByText('添加标签'));
  expect(repository.preview).not.toHaveBeenCalled();
  expect(repository.apply).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('生成预览'));
  await waitFor(() => expect(repository.preview).toHaveBeenCalledWith(['book-a', 'book-b'], expect.objectContaining({ addTagIds: [expect.any(String)], newTags: [{ id: expect.any(String), name: '赛博朋克' }] })));
});

test('disables confirmation when every selected book is unchanged and preserves draft on cancel', async () => {
  const unchanged: BulkOrganizePreview = { ...preview, changedCount: 0, unchangedCount: 2, items: preview.items.map(item => ({ ...item, addedTagIds: [], typeChanged: false, changed: false, after: item.before })) };
  const { repository, onCancel, view } = await setup({ preview: unchanged });
  await fireEvent.press(view.getByText('BL'));
  await fireEvent.press(view.getByText('生成预览'));
  await waitFor(() => expect(view.getByText('没有需要修改的内容')).toBeTruthy());
  expect(view.getByRole('button', { name: '确认修改' }).props.accessibilityState).toEqual({ disabled: true });
  await fireEvent.press(view.getByText('返回选择'));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(repository.apply).not.toHaveBeenCalled();
});

test('reports stale previews and does not call completion', async () => {
  const apply = jest.fn().mockRejectedValue(new Error('预览已过期，请重新生成'));
  const { onComplete, view } = await setup({ apply });
  await fireEvent.press(view.getByText('BL'));
  await fireEvent.press(view.getByText('生成预览'));
  await waitFor(() => expect(view.getByText('确认修改')).toBeTruthy());
  await fireEvent.press(view.getByText('确认修改'));
  await waitFor(() => expect(view.getByText('预览已过期，请返回重新生成')).toBeTruthy());
  expect(onComplete).not.toHaveBeenCalled();
  expect(apply).toHaveBeenCalledTimes(1);
});
