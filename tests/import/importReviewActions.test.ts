import { parseTextImport } from '../../src/import/textImportParser';
import { applyImportReviewAction, type ImportReview } from '../../src/import/importReviewActions';
import { validateImportReview } from '../../src/import/importReview';

function review(): ImportReview {
  const first = parseTextImport('书名：残次品\n摘记：第一条', 'blocks', 'finished').candidates[0];
  const second = parseTextImport('书名：默读\n摘记：第二条', 'blocks', 'finished').candidates[0];
  first.id = 'candidate-1';
  second.id = 'candidate-2';
  return {
    items: [
      { candidate: first, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] },
      { candidate: second, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] },
    ],
    fragments: [{ id: 'fragment-1', sourceLine: 3, text: 'top1', reason: '回复归属待确认', sourceRef: { kind: 'screenshot', pageId: 'page-1', line: 3 }, recordedAtHint: '24-10-27 12:12' }],
    fragmentDecisions: {},
  };
}

test('attaches a fragment to a chosen book only as a non-empty editable note', () => {
  const next = applyImportReviewAction(review(), { type: 'fragment_to_note', fragmentId: 'fragment-1', candidateId: 'candidate-1', noteId: 'note-from-fragment', body: 'top1' });

  expect(next.items[0].candidate.notes).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'note-from-fragment', body: 'top1', originalRecordedOn: null, recordedAtHint: '24-10-27 12:12' })]));
  expect(next.fragmentDecisions['fragment-1']).toEqual({ kind: 'note', noteId: 'note-from-fragment' });
  expect(validateImportReview(next)).toEqual([]);
});

test('creates a new editable candidate when a fragment is interpreted as a book', () => {
  const next = applyImportReviewAction(review(), { type: 'fragment_to_book', fragmentId: 'fragment-1', candidateId: 'candidate-3', title: '新书' });

  expect(next.items).toEqual(expect.arrayContaining([expect.objectContaining({ candidate: expect.objectContaining({ id: 'candidate-3', title: '新书' }) })]));
  expect(next.fragmentDecisions['fragment-1']).toEqual({ kind: 'book', candidateId: 'candidate-3' });
});

test('moves notes and keeps fragment decisions aligned when candidates are split or merged', () => {
  const withNote = applyImportReviewAction(review(), { type: 'fragment_to_note', fragmentId: 'fragment-1', candidateId: 'candidate-1', noteId: 'note-from-fragment', body: 'top1' });
  const split = applyImportReviewAction(withNote, { type: 'split_candidate', sourceCandidateId: 'candidate-1', newCandidateId: 'candidate-3', noteIds: ['note-from-fragment'] });
  expect(split.items.find(item => item.candidate.id === 'candidate-1')?.candidate.notes).toHaveLength(1);
  expect(split.items.find(item => item.candidate.id === 'candidate-3')?.candidate.notes).toHaveLength(1);
  expect(split.fragmentDecisions['fragment-1']).toEqual({ kind: 'note', noteId: 'note-from-fragment' });
  const merged = applyImportReviewAction(split, { type: 'merge_candidates', sourceCandidateId: 'candidate-3', targetCandidateId: 'candidate-2' });
  expect(merged.items.some(item => item.candidate.id === 'candidate-3')).toBe(false);
  expect(merged.items.find(item => item.candidate.id === 'candidate-2')?.candidate.notes).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'note-from-fragment' })]));
});

test('requires every fragment decision to target an active candidate and validates confirmed dates', () => {
  const current = review();
  current.items[0].action = 'skip';
  expect(validateImportReview(current).map(issue => issue.code)).toEqual(expect.arrayContaining(['unacknowledged_fragment']));
  const attached = applyImportReviewAction(review(), { type: 'fragment_to_note', fragmentId: 'fragment-1', candidateId: 'candidate-1', noteId: 'note-from-fragment', body: '' });
  expect(validateImportReview(attached).map(issue => issue.code)).toEqual(expect.arrayContaining(['empty_note']));
  expect(() => applyImportReviewAction(review(), { type: 'set_note_date', noteId: 'candidate-1-note-1', date: '2024-02-31', time: null })).toThrow('日期');
  const dated = applyImportReviewAction(review(), { type: 'set_note_date', noteId: 'candidate-1-note-1', date: '2024-10-27', time: '23:59' });
  expect(dated.items[0].candidate.notes[0]).toMatchObject({ originalRecordedOn: '2024-10-27', originalRecordedTime: '23:59' });
});

test('deleting a fragment note removes its decision instead of leaving a false processed state', () => {
  const attached = applyImportReviewAction(review(), { type: 'fragment_to_note', fragmentId: 'fragment-1', candidateId: 'candidate-1', noteId: 'note-from-fragment', body: 'top1' });
  const deleted = applyImportReviewAction(attached, { type: 'delete_note', noteId: 'note-from-fragment' });
  expect(deleted.items[0].candidate.notes.some(note => note.id === 'note-from-fragment')).toBe(false);
  expect(deleted.fragmentDecisions['fragment-1']).toBeUndefined();
  expect(validateImportReview(deleted).map(issue => issue.code)).toContain('unacknowledged_fragment');
});

test('splitting a thought does not duplicate the original book reading history or rating', () => {
  const current = review();
  const original = current.items[0].candidate;
  original.sessions = [{ ordinal: 1, outcome: 'finished', startedOn: '2024-01-01', endedOn: '2024-01-02' }];
  original.ratingHalfStars = 9;
  original.notes[0].sourceRef = { kind: 'screenshot', pageId: 'page-1', line: 7 };

  const split = applyImportReviewAction(current, { type: 'split_candidate', sourceCandidateId: 'candidate-1', newCandidateId: 'candidate-3', noteIds: [original.notes[0].id] });
  const separated = split.items.find(item => item.candidate.id === 'candidate-3')?.candidate;
  expect(separated?.sessions).toEqual([]);
  expect(separated?.ratingHalfStars).toBeNull();
  expect(separated?.sourceRef).toEqual({ kind: 'screenshot', pageId: 'page-1', line: 7 });
});

test('merging candidates does not silently discard conflicting reading histories', () => {
  const current = review();
  current.items[0].candidate.sessions = [{ ordinal: 1, outcome: 'finished', startedOn: '2024-01-01', endedOn: '2024-01-02' }];
  current.items[1].candidate.sessions = [{ ordinal: 1, outcome: 'finished', startedOn: '2025-01-01', endedOn: '2025-01-02' }];

  expect(() => applyImportReviewAction(current, { type: 'merge_candidates', sourceCandidateId: 'candidate-2', targetCandidateId: 'candidate-1' })).toThrow('阅读记录');
});

test('merging candidates requires duplicate acknowledgements to be checked again', () => {
  const current = review();
  current.items[0].acknowledgedDuplicateBookIds = ['existing-book'];
  current.items[0].acknowledgedDuplicateNoteIds = ['existing-note'];
  const merged = applyImportReviewAction(current, { type: 'merge_candidates', sourceCandidateId: 'candidate-2', targetCandidateId: 'candidate-1' });

  expect(merged.items[0].acknowledgedDuplicateBookIds).toEqual([]);
  expect(merged.items[0].acknowledgedDuplicateNoteIds).toEqual([]);
});

test('cannot merge away a fragment that was explicitly assigned as a new book', () => {
  const withBook = applyImportReviewAction(review(), { type: 'fragment_to_book', fragmentId: 'fragment-1', candidateId: 'candidate-3', title: 'top1' });
  withBook.items.find(item => item.candidate.id === 'candidate-3')!.candidate.status = 'finished';

  expect(() => applyImportReviewAction(withBook, { type: 'merge_candidates', sourceCandidateId: 'candidate-3', targetCandidateId: 'candidate-1' })).toThrow('原文片段');
  expect(withBook.fragmentDecisions['fragment-1']).toEqual({ kind: 'book', candidateId: 'candidate-3' });
});

test('confirming an uncertain field clears only that field warning and keeps source evidence', () => {
  const current = review();
  current.fragments = [];
  current.items[0].candidate.fieldReview = { author: '作者不明确', ratingHalfStars: '评分不明确' };
  const sourceText = current.items[0].candidate.sourceText;
  const next = applyImportReviewAction(current, { type: 'confirm_field', candidateId: 'candidate-1', field: 'author' });
  expect(next.items[0].candidate.sourceText).toBe(sourceText);
  expect(next.items[0].confirmedFields).toEqual(['author']);
  expect(validateImportReview(next).filter(issue => issue.code === 'unconfirmed_field')).toHaveLength(1);
  expect(validateImportReview(current).filter(issue => issue.code === 'unconfirmed_field')).toHaveLength(2);
});
