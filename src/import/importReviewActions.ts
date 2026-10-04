import type { ImportCandidate, ImportNoteDraft } from './importTypes';
import type { ImportReview, ImportReviewAction } from './importReview';

export type { ImportReview, ImportReviewAction } from './importReview';

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}
function validTime(value: string): boolean { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
function findNote(review: ImportReview, noteId: string): { candidate: ImportCandidate; note: ImportNoteDraft } | null {
  for (const item of review.items) {
    const note = item.candidate.notes.find(entry => entry.id === noteId);
    if (note) return { candidate: item.candidate, note };
  }
  return null;
}
function withItems(review: ImportReview, items: ImportReview['items'], fragmentDecisions = review.fragmentDecisions): ImportReview {
  return { ...review, items, fragmentDecisions };
}

export function applyImportReviewAction(review: ImportReview, action: ImportReviewAction): ImportReview {
  if (action.type === 'ignore_fragment') {
    if (!review.fragments.some(fragment => fragment.id === action.fragmentId)) return review;
    return withItems(review, review.items, { ...review.fragmentDecisions, [action.fragmentId]: { kind: 'ignore' } });
  }
  if (action.type === 'fragment_to_book') {
    const fragment = review.fragments.find(entry => entry.id === action.fragmentId);
    if (!fragment) return review;
    const candidate: ImportCandidate = {
      id: action.candidateId, sourceLine: fragment.sourceLine, sourceText: fragment.text, title: action.title, author: null, protagonists: [], status: 'want_to_read', ratingHalfStars: null,
      bookType: null, tagIds: [], sessions: [], notes: [], whyWantToRead: null, platform: null, sourceRef: fragment.sourceRef,
    };
    return withItems(review, [...review.items, { candidate, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] }], { ...review.fragmentDecisions, [action.fragmentId]: { kind: 'book', candidateId: action.candidateId } });
  }
  if (action.type === 'fragment_to_note') {
    const fragment = review.fragments.find(entry => entry.id === action.fragmentId);
    const targetIndex = review.items.findIndex(item => item.candidate.id === action.candidateId);
    if (!fragment || targetIndex < 0) return review;
    const note: ImportNoteDraft = { id: action.noteId, body: action.body, originalRecordedOn: null, originalRecordedTime: null, sourceText: fragment.text, sourceRef: fragment.sourceRef, ...(fragment.recordedAtHint ? { recordedAtHint: fragment.recordedAtHint } : {}) };
    const items = [...review.items];
    const target = items[targetIndex];
    items[targetIndex] = { ...target, candidate: { ...target.candidate, notes: [...target.candidate.notes.filter(existing => existing.id !== action.noteId), note] } };
    return withItems(review, items, { ...review.fragmentDecisions, [action.fragmentId]: { kind: 'note', noteId: action.noteId } });
  }
  if (action.type === 'move_note') {
    const source = findNote(review, action.noteId);
    const targetIndex = review.items.findIndex(item => item.candidate.id === action.targetCandidateId);
    if (!source || targetIndex < 0 || source.candidate.id === action.targetCandidateId) return review;
    const items = review.items.map(item => item.candidate.id === source.candidate.id ? { ...item, candidate: { ...item.candidate, notes: item.candidate.notes.filter(note => note.id !== action.noteId) } } : item);
    const target = items[targetIndex];
    items[targetIndex] = { ...target, candidate: { ...target.candidate, notes: [...target.candidate.notes, source.note] } };
    return withItems(review, items);
  }
  if (action.type === 'delete_note') {
    const source = findNote(review, action.noteId);
    if (!source) return review;
    const decisions = Object.fromEntries(Object.entries(review.fragmentDecisions).filter(([, decision]) => decision.kind !== 'note' || decision.noteId !== action.noteId));
    return withItems(review, review.items.map(item => item.candidate.id === source.candidate.id ? { ...item, candidate: { ...item.candidate, notes: item.candidate.notes.filter(note => note.id !== action.noteId) } } : item), decisions);
  }
  if (action.type === 'split_candidate') {
    const sourceIndex = review.items.findIndex(item => item.candidate.id === action.sourceCandidateId);
    if (sourceIndex < 0 || review.items.some(item => item.candidate.id === action.newCandidateId)) return review;
    const source = review.items[sourceIndex];
    const moved = source.candidate.notes.filter(note => action.noteIds.includes(note.id));
    if (!moved.length) return review;
    const nextSource = { ...source, candidate: { ...source.candidate, notes: source.candidate.notes.filter(note => !action.noteIds.includes(note.id)) } };
    const newCandidate: ImportCandidate = { ...source.candidate, id: action.newCandidateId, title: '', notes: moved };
    const items = [...review.items]; items[sourceIndex] = nextSource; items.push({ ...source, candidate: newCandidate });
    const decisions = Object.fromEntries(Object.entries(review.fragmentDecisions).map(([id, decision]) => decision.kind === 'note' && action.noteIds.includes(decision.noteId) ? [id, decision] : [id, decision]));
    return withItems(review, items, decisions);
  }
  if (action.type === 'merge_candidates') {
    const sourceIndex = review.items.findIndex(item => item.candidate.id === action.sourceCandidateId);
    const targetIndex = review.items.findIndex(item => item.candidate.id === action.targetCandidateId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return review;
    const source = review.items[sourceIndex];
    const target = review.items[targetIndex];
    const items = review.items.filter((_, index) => index !== sourceIndex).map(item => item.candidate.id === target.candidate.id ? { ...item, candidate: { ...item.candidate, notes: [...item.candidate.notes, ...source.candidate.notes] } } : item);
    const decisions = Object.fromEntries(Object.entries(review.fragmentDecisions).map(([id, decision]) => decision.kind === 'book' && decision.candidateId === source.candidate.id ? [id, { kind: 'book', candidateId: target.candidate.id }] : [id, decision]));
    return withItems(review, items, decisions);
  }
  if (action.type === 'set_note_date') {
    const found = findNote(review, action.noteId);
    if (!found) return review;
    if (action.date !== null && !validDate(action.date)) throw new Error('原记录日期无效，请使用有效的四位 YYYY-MM-DD');
    if (action.time !== null && !validTime(action.time)) throw new Error('原记录时间无效，请使用 HH:MM');
    return withItems(review, review.items.map(item => item.candidate.id === found.candidate.id ? { ...item, candidate: { ...item.candidate, notes: item.candidate.notes.map(note => note.id === action.noteId ? { ...note, originalRecordedOn: action.date, originalRecordedTime: action.time } : note) } } : item));
  }
  return review;
}
