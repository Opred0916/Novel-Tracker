import type { BookStatus, BookType } from '../books/types';

export type ImportMode = 'lines' | 'blocks' | 'numbered_replies';

export type ImportSessionDraft = {
  ordinal: number;
  outcome: 'reading' | 'finished' | 'dropped';
  startedOn: string | null;
  endedOn: string | null;
};

export type ImportSourceRef = { kind: 'screenshot'; pageId: string; line: number };

export type ImportNoteDraft = {
  id: string;
  body: string;
  originalRecordedOn: string | null;
  originalRecordedTime: string | null;
  sourceText: string;
  sourceRef?: ImportSourceRef;
  recordedAtHint?: string;
};

export type ImportCandidate = {
  id: string;
  sourceLine: number;
  sourceText: string;
  title: string;
  author: string | null;
  protagonists: string[];
  status: BookStatus;
  ratingHalfStars: number | null;
  bookType: BookType | null;
  tagIds: string[];
  sessions: ImportSessionDraft[];
  notes: ImportNoteDraft[];
  whyWantToRead: string | null;
  platform: string | null;
  sourceRef?: ImportSourceRef;
  fieldReview?: Partial<Record<'title' | 'author' | 'ratingHalfStars' | 'status' | 'notes', string>>;
};

export type ImportFragment = { id: string; sourceLine: number; text: string; reason: string; sourceRef?: ImportSourceRef; recordedAtHint?: string; candidateId?: string };
export type ImportParseResult = { candidates: ImportCandidate[]; fragments: ImportFragment[]; warnings: string[] };
