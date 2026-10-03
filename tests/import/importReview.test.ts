import { parseTextImport } from '../../src/import/textImportParser';
import {
  findImportDuplicates,
  normalizeDuplicateKey,
  summarizeImport,
  validateImportReview,
  type ImportReview,
} from '../../src/import/importReview';

function review(overrides: Partial<ImportReview> = {}): ImportReview {
  const candidate = parseTextImport('书名：残次品\n状态：已读\n摘记：很好看', 'blocks', 'want_to_read').candidates[0];
  return {
    items: [{ candidate, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] }],
    fragments: [], ignoredFragmentIds: [], ...overrides,
  };
}

test('normalizes Unicode, spaces, and English case without deleting meaningful punctuation', () => {
  expect(normalizeDuplicateKey('  Ａ Book\u3000Name  ')).toBe('a book name');
  expect(normalizeDuplicateKey('书名：残次品')).not.toBe(normalizeDuplicateKey('书名 残次品'));
});

test('finds existing, same-batch, and same-book note duplicates without merging automatically', () => {
  const current = review();
  const second = { ...current.items[0], candidate: { ...current.items[0].candidate, id: 'candidate-2' } };
  current.items.push(second);
  const hints = findImportDuplicates(current, [{ id: 'book-1', title: '残次品', author: null }], [{ id: 'note-1', bookId: 'book-1', body: '很好看' }]);
  expect(hints).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'book', candidateId: 'candidate-1', targetBookId: 'book-1' }),
    expect.objectContaining({ kind: 'book', candidateId: 'candidate-2' }),
    expect.objectContaining({ kind: 'note', candidateId: 'candidate-1', existingNoteId: 'note-1' }),
  ]));
  expect(current.items[0].action).toBe('create');
});

test('validates actions, dates, scores, ordering, append targets, and fragments', () => {
  const current = review({ fragments: [{ id: 'f1', sourceLine: 8, text: '未归属', reason: 'unknown' }] });
  current.items[0].candidate.ratingHalfStars = 9;
  current.items[0].candidate.status = 'reading';
  current.items[0].candidate.sessions = [
    { ordinal: 1, outcome: 'reading', startedOn: null, endedOn: null },
    { ordinal: 1, outcome: 'finished', startedOn: '2026-10-02', endedOn: '2026-10-01' },
  ];
  current.items[0].action = 'append_notes';
  const issues = validateImportReview(current);
  expect(issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
    'rating_requires_finished', 'duplicate_session_ordinal', 'reading_session_must_be_last', 'invalid_session_dates', 'append_target_required', 'unacknowledged_fragment',
  ]));
  expect(validateImportReview({ ...current, ignoredFragmentIds: ['f1'], items: [{ ...current.items[0], action: 'skip' }] })).toEqual(expect.arrayContaining([]));
});

test('summarizes create, note append, and skip actions', () => {
  const current = review();
  current.items.push({ ...current.items[0], candidate: { ...current.items[0].candidate, id: 'candidate-2', notes: [] }, action: 'skip' });
  current.items.push({ ...current.items[0], candidate: { ...current.items[0].candidate, id: 'candidate-3' }, action: 'append_notes', targetBookId: 'book-1' });
  expect(summarizeImport(current)).toEqual({ createdBooks: 1, createdNotes: 1, appendedNotes: 1, skippedItems: 1 });
});
