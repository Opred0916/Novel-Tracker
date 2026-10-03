import { normalizeHistoricalReadingDates } from '../books/readingDates';
import type { ImportCandidate, ImportFragment } from './importTypes';

export type ImportReviewItem = {
  candidate: ImportCandidate;
  action: 'create' | 'skip' | 'append_notes';
  targetBookId: string | null;
  acknowledgedDuplicateBookIds: string[];
  acknowledgedDuplicateNoteIds: string[];
};

export type ImportReview = { items: ImportReviewItem[]; fragments: ImportFragment[]; ignoredFragmentIds: string[] };
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
  const ignored = new Set(review.ignoredFragmentIds);
  for (const fragment of review.fragments) if (!ignored.has(fragment.id)) issues.push({ code: 'unacknowledged_fragment', fragmentId: fragment.id, message: `还有未处理的原文：${fragment.text}` });
  for (const item of review.items) {
    const candidate = item.candidate;
    if (!candidate.title.trim()) issues.push(issue('empty_title', '书名不能为空', candidate.id));
    if (candidate.ratingHalfStars !== null && candidate.status !== 'finished') issues.push(issue('rating_requires_finished', '只有已读书籍可以填写评分', candidate.id));
    if (item.action === 'append_notes' && !item.targetBookId) issues.push(issue('append_target_required', '追加摘记必须选择目标书籍', candidate.id));
    if (item.action === 'append_notes' && candidate.notes.length === 0) issues.push(issue('append_notes_required', '追加摘记操作至少需要一条摘记', candidate.id));
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
