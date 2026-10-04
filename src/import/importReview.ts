import { normalizeHistoricalReadingDates } from '../books/readingDates';
import type { ImportCandidate, ImportFragment } from './importTypes';

export type ImportReviewItem = {
  candidate: ImportCandidate;
  action: 'create' | 'skip' | 'append_notes';
  targetBookId: string | null;
  acknowledgedDuplicateBookIds: string[];
  acknowledgedDuplicateNoteIds: string[];
};

export type ImportFragmentDecision = { kind: 'ignore' } | { kind: 'book'; candidateId: string } | { kind: 'note'; noteId: string };
export type ImportReview = { items: ImportReviewItem[]; fragments: ImportFragment[]; fragmentDecisions: Record<string, ImportFragmentDecision>; warnings?: string[] };
export type ImportReviewAction =
  | { type: 'ignore_fragment'; fragmentId: string }
  | { type: 'fragment_to_book'; fragmentId: string; candidateId: string; title: string }
  | { type: 'fragment_to_note'; fragmentId: string; candidateId: string; noteId: string; body: string }
  | { type: 'move_note'; noteId: string; targetCandidateId: string }
  | { type: 'delete_note'; noteId: string }
  | { type: 'split_candidate'; sourceCandidateId: string; newCandidateId: string; noteIds: string[] }
  | { type: 'merge_candidates'; sourceCandidateId: string; targetCandidateId: string }
  | { type: 'set_note_date'; noteId: string; date: string | null; time: string | null };
export type ExistingBookSummary = { id: string; title: string; author: string | null };
export type ExistingNoteSummary = { id: string; bookId: string; body: string };
export type DuplicateHint = {
  kind: 'book' | 'note'; candidateId: string; targetBookId?: string; existingBookId?: string; existingNoteId?: string; otherCandidateId?: string; message: string;
};
export type ImportValidationIssue = { code: string; candidateId?: string; fragmentId?: string; message: string };
export type ImportSummary = { createdBooks: number; createdNotes: number; appendedNotes: number; skippedItems: number };

export function normalizeDuplicateKey(title: string): string {
  return title.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}

function noteKey(body: string): string { return body.normalize('NFKC').trim().replace(/\s+/gu, ' '); }
function validOriginalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}
function validOriginalTime(value: string): boolean { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }

export function findImportDuplicates(review: ImportReview, existingBooks: ExistingBookSummary[], existingNotes: ExistingNoteSummary[]): DuplicateHint[] {
  const hints: DuplicateHint[] = [];
  const booksByKey = new Map(existingBooks.map(book => [normalizeDuplicateKey(book.title), book]));
  for (const item of review.items) {
    const existing = booksByKey.get(normalizeDuplicateKey(item.candidate.title));
    if (existing) hints.push({ kind: 'book', candidateId: item.candidate.id, targetBookId: existing.id, existingBookId: existing.id, message: `书名可能已存在：${existing.title}` });
  }
  for (let index = 0; index < review.items.length; index += 1) {
    for (let other = index + 1; other < review.items.length; other += 1) {
      if (normalizeDuplicateKey(review.items[index].candidate.title) === normalizeDuplicateKey(review.items[other].candidate.title)) {
        hints.push({ kind: 'book', candidateId: review.items[other].candidate.id, otherCandidateId: review.items[index].candidate.id, message: '本次导入中有相同书名，应用前请确认是否是同一本书' });
      }
    }
  }
  for (const item of review.items) {
    const existingBook = booksByKey.get(normalizeDuplicateKey(item.candidate.title));
    const targetBookId = item.targetBookId ?? existingBook?.id;
    if (!targetBookId) continue;
    const noteBodies = existingNotes.filter(note => note.bookId === targetBookId).map(note => [noteKey(note.body), note] as const);
    for (const imported of item.candidate.notes) {
      const duplicate = noteBodies.find(([body]) => body === noteKey(imported.body));
      if (duplicate) hints.push({ kind: 'note', candidateId: item.candidate.id, targetBookId, existingNoteId: duplicate[1].id, message: '摘记正文与现有摘记相同，请确认是否仍要追加' });
    }
  }
  return hints;
}

function issue(code: string, message: string, candidateId?: string): ImportValidationIssue { return { code, message, ...(candidateId ? { candidateId } : {}) }; }

export function validateImportReview(review: ImportReview): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = [];
  const decisions = review.fragmentDecisions ?? {};
  const itemsById = new Map(review.items.map(item => [item.candidate.id, item]));
  const notesById = new Map(review.items.flatMap(item => item.candidate.notes.map(note => [note.id, { note, item }] as const)));
  for (const fragment of review.fragments) {
    const decision = decisions[fragment.id];
    if (!decision) { issues.push({ code: 'unacknowledged_fragment', fragmentId: fragment.id, message: `还有未处理的原文：${fragment.text}` }); continue; }
    if (decision.kind === 'book') {
      const target = itemsById.get(decision.candidateId);
      if (!target) issues.push({ code: 'fragment_target_missing', fragmentId: fragment.id, message: '片段指定的候选书目不存在' });
      else if (target.action === 'skip') issues.push({ code: 'fragment_target_skipped', fragmentId: fragment.id, message: '片段不能指定给已跳过的候选书目' });
    } else if (decision.kind === 'note') {
      const target = notesById.get(decision.noteId);
      if (!target) issues.push({ code: 'fragment_note_missing', fragmentId: fragment.id, message: '片段指定的摘记不存在' });
      else if (target.item.action === 'skip') issues.push({ code: 'fragment_target_skipped', fragmentId: fragment.id, message: '片段不能指定给已跳过的候选书目' });
    }
  }
  for (const item of review.items) {
    const candidate = item.candidate;
    if (!candidate.title.trim()) issues.push(issue('empty_title', '书名不能为空', candidate.id));
    if (candidate.ratingHalfStars !== null && candidate.status !== 'finished') issues.push(issue('rating_requires_finished', '只有已读书籍可以填写评分', candidate.id));
    if (item.action === 'append_notes' && !item.targetBookId) issues.push(issue('append_target_required', '追加摘记必须选择目标书籍', candidate.id));
    if (item.action === 'append_notes' && candidate.notes.length === 0) issues.push(issue('append_notes_required', '追加摘记操作至少需要一条摘记', candidate.id));
    for (const note of candidate.notes) {
      if (!note.body.trim()) issues.push(issue('empty_note', '摘记正文不能为空', candidate.id));
      if (note.originalRecordedOn !== null && !validOriginalDate(note.originalRecordedOn)) issues.push(issue('invalid_note_date', '摘记原记录日期无效，请使用有效的四位 YYYY-MM-DD', candidate.id));
      if (note.originalRecordedTime !== null && !validOriginalTime(note.originalRecordedTime)) issues.push(issue('invalid_note_time', '摘记原记录时间无效，请使用 HH:MM', candidate.id));
    }
    const ordinals = new Set<number>();
    for (const session of candidate.sessions) {
      if (ordinals.has(session.ordinal)) issues.push(issue('duplicate_session_ordinal', `第 ${session.ordinal} 次阅读重复`, candidate.id));
      ordinals.add(session.ordinal);
      try { normalizeHistoricalReadingDates(session.outcome, session.startedOn, session.endedOn); }
      catch { issues.push(issue('invalid_session_dates', `第 ${session.ordinal} 次阅读日期无效`, candidate.id)); }
    }
    const activeIndex = candidate.sessions.findIndex(session => session.outcome === 'reading');
    if (activeIndex >= 0 && activeIndex !== candidate.sessions.length - 1) issues.push(issue('reading_session_must_be_last', '在读记录必须是最后一次阅读', candidate.id));
  }
  return issues;
}

export function summarizeImport(review: ImportReview): ImportSummary {
  return review.items.reduce((summary, item) => {
    if (item.action === 'create') { summary.createdBooks += 1; summary.createdNotes += item.candidate.notes.length; }
    else if (item.action === 'append_notes') summary.appendedNotes += item.candidate.notes.length;
    else summary.skippedItems += 1;
    return summary;
  }, { createdBooks: 0, createdNotes: 0, appendedNotes: 0, skippedItems: 0 });
}
