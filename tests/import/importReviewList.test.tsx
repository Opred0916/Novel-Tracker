import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ImportReviewList } from '../../src/import/ImportReviewList';
import { parseTextImport } from '../../src/import/textImportParser';
import type { ImportReview } from '../../src/import/importReview';

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
