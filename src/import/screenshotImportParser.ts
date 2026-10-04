import { BOOK_STATUSES, type BookStatus } from '../books/types';
import { MAX_IMPORT_BYTES, MAX_IMPORT_CANDIDATES } from './textImportParser';
import type { ScreenshotPageDraft } from './screenshotImportDraft';
import type { ImportCandidate, ImportFragment, ImportMode, ImportNoteDraft, ImportParseResult, ImportSourceRef } from './importTypes';

type SourceLine = { pageId: string; line: number; raw: string; text: string };

const STATUS_LABELS: Record<string, BookStatus> = {
  want_to_read: 'want_to_read', reading: 'reading', finished: 'finished', dropped: 'dropped',
  想读: 'want_to_read', 在读: 'reading', 阅读中: 'reading', 已读: 'finished', 读完: 'finished', 弃读: 'dropped',
};

function sourceRef(line: SourceLine): ImportSourceRef { return { kind: 'screenshot', pageId: line.pageId, line: line.line }; }
function byteLength(text: string): number { return new TextEncoder().encode(text).byteLength; }
function cleanTitle(value: string): string {
  return value.replace(/^\s*\d{1,4}(?=\D)/, '').replace(/^[-—|：:\s]+/, '').replace(/[，,。；;]+$/, '').trim();
}
function splitLines(page: ScreenshotPageDraft): SourceLine[] {
  return page.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').map((raw, index) => ({ pageId: page.id, line: index + 1, raw, text: raw.trim() })).filter(line => line.text);
}
function dateHint(text: string): string | null {
  return text.match(/\b\d{2,4}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s+\d{1,2}:\d{2})?/)?.[0] ?? null;
}
function authorPrefix(text: string): string | null {
  return text.match(/^[^:：]{1,40}\s+博主\s*[:：]\s*(.*)$/)?.[1]?.trim() ?? null;
}
function isUiNoise(text: string): boolean {
  return /^(?:来自\s*|点赞\s*\d*|评论\s*\d*|转发\s*\d*|收藏\s*\d*|共\d+条回复|[^:：]{1,40}\s+博主\s*$)/.test(text);
}
function numberedTitle(text: string): string | null {
  if (dateHint(text)) return null;
  const body = authorPrefix(text) ?? text;
  const match = body.match(/^\s*\d{1,4}(?=\D)(.+?)\s*$/);
  return match ? cleanTitle(match[1]) : null;
}
function emptyCandidate(id: string, line: SourceLine, title: string, status: BookStatus): ImportCandidate {
  return { id, sourceLine: line.line, sourceText: line.raw, title: cleanTitle(title), author: null, protagonists: [], status, ratingHalfStars: null, bookType: null, tagIds: [], sessions: [], notes: [], whyWantToRead: null, platform: null, sourceRef: sourceRef(line) };
}
function addCandidate(result: ImportParseResult, candidate: ImportCandidate): ImportCandidate {
  if (!candidate.title) return candidate;
  result.candidates.push(candidate);
  if (result.candidates.length > MAX_IMPORT_CANDIDATES) throw new Error('一次最多导入 500 本小说');
  return candidate;
}
function addFragment(result: ImportParseResult, id: string, line: SourceLine, text: string, reason: string, candidate: ImportCandidate | null, recordedAtHint: string | null): void {
  result.fragments.push({ id, sourceLine: line.line, text: text.trim(), reason, sourceRef: sourceRef(line), ...(recordedAtHint ? { recordedAtHint } : {}), ...(candidate ? { candidateId: candidate.id } : {}) });
}
function pageGroups(pages: ScreenshotPageDraft[]): ScreenshotPageDraft[][] {
  const groups: ScreenshotPageDraft[][] = [];
  for (const page of pages) {
    if (!page.continuesPrevious || !groups.length) groups.push([page]);
    else groups[groups.length - 1].push(page);
  }
  return groups;
}

function parseNumberedGroup(pages: ScreenshotPageDraft[], status: BookStatus, result: ImportParseResult, nextCandidateId: () => string): void {
  let current: ImportCandidate | null = null;
  let hint: string | null = null;
  let fragmentIndex = result.fragments.length + 1;
  for (const line of pages.flatMap(splitLines)) {
    const foundDate = dateHint(line.text);
    if (foundDate) { hint = foundDate; continue; }
    const title = numberedTitle(line.text);
    const prefixed = authorPrefix(line.text);
    if (title) {
      current = addCandidate(result, emptyCandidate(nextCandidateId(), line, title, status));
      hint = null;
      continue;
    }
    const count = line.text.match(/^共\d+条回复/);
    if (count) {
      result.warnings.push(`“${line.text}”未展开，可能有回复未被导入`);
      hint = null;
      continue;
    }
    const reply = prefixed ?? line.text;
    if (prefixed !== null || (current && !isUiNoise(line.text))) {
      if (reply && !/^\d{2,4}[-/.]\d/.test(reply)) {
        addFragment(result, `fragment-${fragmentIndex++}`, line, reply, current ? '回复归属待确认' : '无法确认书目', current, hint);
      }
      hint = null;
      continue;
    }
    if (!isUiNoise(line.text)) addFragment(result, `fragment-${fragmentIndex++}`, line, line.text, current ? '回复归属待确认' : '无法确认书目', current, hint);
    hint = null;
  }
}

function field(line: string): [string, string] | null {
  const match = line.match(/^\s*(书名|标题|title|作者|author|主角|角色|protagonists?|状态|status|评分|rating|作品类型|类型|type|标签|tags|摘记|想法|我的想法|备注|日期|时间)\s*[:：]\s*(.*?)\s*$/i);
  return match ? [match[1].toLowerCase(), match[2]] : null;
}
function addBlockNote(candidate: ImportCandidate, line: SourceLine, body: string, hint: string | null): void {
  if (!body.trim()) return;
  const note: ImportNoteDraft = { id: `${candidate.id}-note-${candidate.notes.length + 1}`, body: body.trim(), originalRecordedOn: null, originalRecordedTime: null, sourceText: line.raw, sourceRef: sourceRef(line), ...(hint ? { recordedAtHint: hint } : {}) };
  candidate.notes.push(note);
}
function parseBlocksGroup(pages: ScreenshotPageDraft[], status: BookStatus, result: ImportParseResult, nextCandidateId: () => string): void {
  const lines = pages.flatMap(splitLines);
  if (!lines.length) return;
  const candidate = addCandidate(result, emptyCandidate(nextCandidateId(), lines[0], lines[0].text, status));
  let hint: string | null = null;
  for (const line of lines) {
    const parsed = field(line.text);
    if (!parsed) {
      if (line !== lines[0] && !isUiNoise(line.text)) addFragment(result, `fragment-${result.fragments.length + 1}`, line, line.text, '无法确认字段归属', candidate, hint);
      continue;
    }
    const [key, value] = parsed;
    const foundDate = dateHint(value);
    if (foundDate) {
      hint = foundDate;
      for (const note of candidate.notes) if (!note.recordedAtHint) note.recordedAtHint = foundDate;
    }
    if (key === '书名' || key === '标题' || key === 'title') candidate.title = cleanTitle(value);
    else if (key === '作者' || key === 'author') candidate.author = value || null;
    else if (key === '主角' || key === '角色' || key === 'protagonists') candidate.protagonists = value.split(/[、,，/&和]+/).map(item => item.trim()).filter(Boolean);
    else if (key === '状态' || key === 'status') candidate.status = STATUS_LABELS[value.trim()] ?? candidate.status;
    else if (key === '摘记' || key === '想法' || key === '我的想法' || key === '备注') addBlockNote(candidate, line, value, hint);
  }
}

function parseLinesGroup(pages: ScreenshotPageDraft[], status: BookStatus, result: ImportParseResult, nextCandidateId: () => string): void {
  for (const line of pages.flatMap(splitLines)) {
    if (isUiNoise(line.text) || dateHint(line.text)) continue;
    const parts = line.text.split(/\s*[|｜]\s*/);
    const candidate = emptyCandidate(nextCandidateId(), line, parts[0], status);
    if (parts[1]) candidate.author = parts[1];
    if (parts[2]) candidate.status = STATUS_LABELS[parts[2].trim()] ?? candidate.status;
    addCandidate(result, candidate);
  }
}

export function parseScreenshotImport(pages: ScreenshotPageDraft[], mode: ImportMode, defaultStatus: BookStatus): ImportParseResult {
  if (!['lines', 'blocks', 'numbered_replies'].includes(mode)) throw new Error('导入模式无效');
  if (!BOOK_STATUSES.includes(defaultStatus)) throw new Error('默认阅读状态无效');
  if (byteLength(pages.map(page => page.text).join('\n')) > MAX_IMPORT_BYTES) throw new Error('导入文字不能超过 1 MiB');
  if (!pages.some(page => page.text.trim())) throw new Error('请输入要导入的文字');
  const result: ImportParseResult = { candidates: [], fragments: [], warnings: [] };
  let candidateIndex = 0;
  const nextCandidateId = () => `screenshot-candidate-${++candidateIndex}`;
  for (const group of pageGroups(pages)) {
    if (mode === 'lines') parseLinesGroup(group, defaultStatus, result, nextCandidateId);
    else if (mode === 'blocks') parseBlocksGroup(group, defaultStatus, result, nextCandidateId);
    else parseNumberedGroup(group, defaultStatus, result, nextCandidateId);
  }
  if (!result.candidates.length) throw new Error('没有识别到可导入的书名');
  return result;
}
