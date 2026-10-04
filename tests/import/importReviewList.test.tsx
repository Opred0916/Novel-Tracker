import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ImportReviewList } from '../../src/import/ImportReviewList';
import { parseTextImport } from '../../src/import/textImportParser';
import { findImportDuplicates, type ImportReview } from '../../src/import/importReview';

function review(): ImportReview {
  const candidate = parseTextImport('书名：残次品\n摘记：一条想法', 'blocks', 'finished').candidates[0];
  return { items: [{ candidate, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] }], fragments: [], fragmentDecisions: {} };
}

test('lets users type a date gradually before final validation', async () => {
  const latest = { current: null as ImportReview | null };
  const screen = await render(<ImportReviewList review={review()} hints={[]} busy={false} onChange={next => { latest.current = next; }} onConfirm={jest.fn()} onCancel={jest.fn()} />);

  await fireEvent.changeText(screen.getByLabelText('第1条摘记1原记录日期'), '2024');

  expect(latest.current?.items[0].candidate.notes[0].originalRecordedOn).toBe('2024');
});

test('shows screenshot and line for the candidate and its note', async () => {
  const value = review();
  value.items[0].candidate.sourceRef = { kind: 'screenshot', pageId: 'page-a', line: 3 };
  value.items[0].candidate.notes[0].sourceRef = { kind: 'screenshot', pageId: 'page-b', line: 5 };
  const screen = await render(<ImportReviewList review={value} hints={[]} busy={false} sourcePages={[{ id: 'page-a', uri: 'file:///record.jpg' }, { id: 'page-b', uri: 'file:///reply.jpg' }]} onChange={jest.fn()} onConfirm={jest.fn()} onCancel={jest.fn()} />);

  expect(screen.getByText('第 1 张截图 · 第 3 行')).toBeTruthy();
  expect(screen.getByText('来源：第 2 张截图 · 第 5 行')).toBeTruthy();
  expect(screen.getByLabelText('第1张截图').props.source).toEqual({ uri: 'file:///record.jpg' });
  expect(screen.getByLabelText('第2张截图').props.source).toEqual({ uri: 'file:///reply.jpg' });
  await fireEvent.press(screen.getByRole('button', { name: '查看第1张截图原图' }));
  expect(screen.getByLabelText('放大截图').props.source).toEqual({ uri: 'file:///record.jpg' });
  await fireEvent.press(screen.getByRole('button', { name: '关闭截图原图' }));
  expect(screen.queryByLabelText('放大截图')).toBeNull();
});

test('can split one thought into a new book and merge candidates back', async () => {
  const value = review();
  const first = value.items[0].candidate.notes[0];
  value.items[0].candidate.notes.push({ ...first, id: 'second-note', body: '另一条想法' });
  let current = value;
  const onChange = (next: ImportReview) => { current = next; };
  const screen = await render(<ImportReviewList review={current} hints={[]} busy={false} onChange={onChange} onConfirm={jest.fn()} onCancel={jest.fn()} />);

  await fireEvent.press(screen.getByRole('button', { name: '拆出第1条摘记为新书' }));
  expect(current.items).toHaveLength(2);
  expect(current.items[0].candidate.notes.map(note => note.body)).toEqual(['另一条想法']);
  expect(current.items[1].candidate.notes.map(note => note.body)).toEqual(['一条想法']);
  await screen.rerender(<ImportReviewList review={current} hints={[]} busy={false} onChange={onChange} onConfirm={jest.fn()} onCancel={jest.fn()} />);

  await fireEvent.press(screen.getByRole('button', { name: '将第2条候选合并到《残次品》' }));
  expect(current.items).toHaveLength(1);
  expect(current.items[0].candidate.notes.map(note => note.body)).toEqual(['另一条想法', '一条想法']);
});

test('preview summary counts appended thoughts and explicitly ignored fragments', async () => {
  const value = review();
  const first = value.items[0].candidate.notes[0];
  value.items[0].candidate.notes.push({ ...first, id: 'second-note', body: '第二条' });
  value.items[0].action = 'append_notes';
  value.items[0].targetBookId = 'existing-book';
  value.fragments = [{ id: 'fragment-1', sourceLine: 4, text: '不导入', reason: '待确认' }];
  value.fragmentDecisions = { 'fragment-1': { kind: 'ignore' } };
  const screen = await render(<ImportReviewList review={value} hints={[]} busy={false} onChange={jest.fn()} onConfirm={jest.fn()} onCancel={jest.fn()} />);

  await waitFor(() => expect(screen.getByText(/追加想法 2 条/)).toBeTruthy());
  expect(screen.getByText(/忽略片段 1 条/)).toBeTruthy();
  expect(screen.getByText(/未处理片段 0 条/)).toBeTruthy();
});

test('allows explicitly keeping two same-title books in one import batch', async () => {
  const value = review();
  const second = { ...value.items[0].candidate, id: 'other-candidate', notes: [] };
  value.items.push({ candidate: second, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] });
  const hints = findImportDuplicates(value, [], []);
  let current = value;
  const screen = await render(<ImportReviewList review={value} hints={hints} busy={false} onChange={next => { current = next; }} onConfirm={jest.fn()} onCancel={jest.fn()} />);

  await fireEvent.press(screen.getByRole('button', { name: '确认仍新增本批同名书' }));
  expect(current.items[1].acknowledgedDuplicateCandidateIds).toEqual([value.items[0].candidate.id]);
  await screen.rerender(<ImportReviewList review={current} hints={hints} busy={false} onChange={next => { current = next; }} onConfirm={jest.fn()} onCancel={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('第2条书名'), '另一本书');
  expect(current.items[1].acknowledgedDuplicateCandidateIds).toEqual([]);
});
