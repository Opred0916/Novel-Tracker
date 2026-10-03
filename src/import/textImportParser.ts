import { BOOK_STATUSES, type BookStatus, type BookType } from '../books/types';
import type { ImportCandidate, ImportMode, ImportNoteDraft, ImportParseResult } from './importTypes';

export const MAX_IMPORT_BYTES = 1_048_576;
export const MAX_IMPORT_CANDIDATES = 500;

const STATUS_LABELS: Record<string, BookStatus> = {
  want_to_read: 'want_to_read', reading: 'reading', finished: 'finished', dropped: 'dropped',
  '想读': 'want_to_read', '在读': 'reading', '阅读中': 'reading', '已读': 'finished', '读完': 'finished', '弃读': 'dropped',
};
const TYPE_LABELS: Record<string, BookType> = {
  '耽美': 'romance_male_male', '纯爱': 'romance_male_male', BL: 'romance_male_male',
  '言情': 'romance_female_male', 'BG': 'romance_female_male', 'GL': 'romance_female_female',
  '百合': 'romance_female_female', '无CP': 'no_romance', '无 CP': 'no_romance', '其他': 'other',
};

type ParsedDate = { on: string; time: string | null; warning?: string } | null;

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function decodeImportUtf8(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new Error('导入文字不能超过 1 MiB');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    throw new Error('导入文件不是有效的 UTF-8 文字');
  }
}

function calendarDate(year: number, month: number, day: number): string | null {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
    ? `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
}

function parseDate(text: string): ParsedDate {
  const full = text.match(/(?:^|\D)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/);
  if (full) {
    const on = calendarDate(Number(full[1]), Number(full[2]), Number(full[3]));
    return on ? { on, time: full[4] ?? null } : null;
  }
  const short = text.match(/(?:^|\D)(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/);
  if (!short) return null;
  const on = calendarDate(2000 + Number(short[1]), Number(short[2]), Number(short[3]));
  return on ? { on, time: short[4] ?? null, warning: `发现两位数年份“${short[1]}”，已暂按 20${short[1]} 解析，请确认` } : null;
}

function statusValue(value: string): BookStatus | null { return STATUS_LABELS[value.trim()] ?? null; }
function typeValue(value: string): BookType | null { return TYPE_LABELS[value.trim()] ?? null; }
function splitNames(value: string): string[] { return value.split(/[、,，/&和]+/).map(item => item.trim()).filter(Boolean); }
function field(line: string): [string, string] | null {
  const match = line.match(/^\s*(书名|标题|title|作者|author|主角|角色|protagonists?|状态|status|评分|rating|作品类型|类型|type|标签|tags|摘记|想法|我的想法|备注|日期|时间|阅读记录)\s*[:：]\s*(.*?)\s*$/i);
  return match ? [match[1].toLowerCase(), match[2]] : null;
}
function cleanTitle(value: string): string {
  return value.replace(/^[-—|：:\s]+/, '').replace(/[，,。；;]+$/, '').trim();
}
function dateLine(text: string): ParsedDate { return parseDate(text); }
function isUrlOnly(text: string): boolean { return /^https?:\/\/\S+$/i.test(text.trim()); }
function isUiNoise(text: string): boolean {
  return /^(?:来自\s|点赞\s*\d*|评论\s*\d*|转发\s*\d*|收藏\s*\d*|博主$|共\d+条回复)/.test(text.trim()) || /^\S+\s+博主\s*$/.test(text.trim());
}

function note(id: string, body: string, sourceText: string, date: ParsedDate): ImportNoteDraft {
  return { id, body: body.trim(), originalRecordedOn: date?.on ?? null, originalRecordedTime: date?.time ?? null, sourceText };
}

function candidate(id: string, sourceLine: number, sourceText: string, title: string, status: BookStatus): ImportCandidate {
  return { id, sourceLine, sourceText, title: cleanTitle(title), author: null, protagonists: [], status, ratingHalfStars: null, bookType: null, tagIds: [], sessions: [], notes: [], whyWantToRead: null, platform: null };
}

function applyField(target: ImportCandidate, key: string, value: string, sourceText: string, lineDate: ParsedDate, warnings: string[]): void {
  if (key === '书名' || key === '标题' || key === 'title') target.title = cleanTitle(value);
  else if (key === '作者' || key === 'author') target.author = value || null;
  else if (key === '主角' || key === '角色' || key === 'protagonists') target.protagonists = splitNames(value);
  else if (key === '状态' || key === 'status') target.status = statusValue(value) ?? target.status;
  else if (key === '评分' || key === 'rating') {
    const score = Number(value.replace('/5', '').trim());
    if (Number.isFinite(score) && score >= 0.5 && score <= 5 && score * 2 === Math.round(score * 2)) target.ratingHalfStars = Math.round(score * 2);
  } else if (key === '作品类型' || key === '类型' || key === 'type') target.bookType = typeValue(value);
  else if (key === '标签' || key === 'tags') target.tagIds = splitNames(value);
  else if (key === '日期' || key === '时间') {
    const parsed = dateLine(value);
    if (parsed?.warning) warnings.push(parsed.warning);
    if (parsed && target.notes.length) {
      for (const item of target.notes) { item.originalRecordedOn = parsed.on; item.originalRecordedTime = parsed.time; }
    }
  } else if (key === '摘记' || key === '想法' || key === '我的想法' || key === '备注') {
    if (value) target.notes.push(note(`${target.id}-note-${target.notes.length + 1}`, value, sourceText, lineDate));
  }
}

function addCandidate(candidates: ImportCandidate[], item: ImportCandidate): void {
  if (!item.title) return;
  candidates.push(item);
  if (candidates.length > MAX_IMPORT_CANDIDATES) throw new Error('一次最多导入 500 本小说');
}

function parseLines(text: string, defaultStatus: BookStatus, result: ImportParseResult): void {
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    if (isUrlOnly(line)) { result.fragments.push({ id: `fragment-${index + 1}`, sourceLine: index + 1, text: line, reason: '链接不会自动抓取，请改为粘贴文字' }); return; }
    const parts = line.split(/\s*[|｜]\s*/);
    const item = candidate(`candidate-${result.candidates.length + 1}`, index + 1, line, parts[0], defaultStatus);
    if (parts.length > 1) {
      if (parts[1]) item.author = parts[1];
      if (parts[2]) item.status = statusValue(parts[2]) ?? item.status;
      if (parts[3]) {
        const score = Number(parts[3]);
        if (Number.isFinite(score) && score >= 0.5 && score <= 5) item.ratingHalfStars = Math.round(score * 2);
      }
    }
    addCandidate(result.candidates, item);
  });
}

function parseBlocks(text: string, defaultStatus: BookStatus, result: ImportParseResult): void {
  const lines = text.split('\n');
  let offset = 0;
  for (const block of text.split(/\n\s*\n/)) {
    const blockLines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const sourceLine = offset + 1;
    offset += block.split('\n').length + 1;
    if (!blockLines.length) continue;
    const firstField = field(blockLines[0]);
    const firstTitle = firstField && ['书名', '标题', 'title'].includes(firstField[0]) ? firstField[1] : blockLines[0];
    if (isUrlOnly(firstTitle)) { result.fragments.push({ id: `fragment-${sourceLine}`, sourceLine, text: firstTitle, reason: '链接不会自动抓取，请改为粘贴文字' }); continue; }
    const item = candidate(`candidate-${result.candidates.length + 1}`, sourceLine, block, firstTitle, defaultStatus);
    let currentDate: ParsedDate = null;
    for (const line of blockLines) {
      const parsedField = field(line);
      if (parsedField) {
        if (parsedField[0] === '日期' || parsedField[0] === '时间') {
          currentDate = dateLine(parsedField[1]);
          if (currentDate?.warning) result.warnings.push(currentDate.warning);
        }
        applyField(item, parsedField[0], parsedField[1], line, currentDate, result.warnings);
      } else if (line !== firstTitle && !isUiNoise(line)) {
        result.fragments.push({ id: `fragment-${sourceLine}-${result.fragments.length + 1}`, sourceLine, text: line, reason: '无法确认字段归属' });
      }
    }
    for (const importedNote of item.notes) if (!importedNote.originalRecordedOn && currentDate) {
      importedNote.originalRecordedOn = currentDate.on; importedNote.originalRecordedTime = currentDate.time;
    }
    addCandidate(result.candidates, item);
  }
  void lines;
}

function numberedHeader(line: string): { title: string; rawTitle: string } | null {
  if (dateLine(line)) return null;
  const afterColon = line.match(/[:：]\s*(.+)$/)?.[1] ?? line;
  const match = afterColon.match(/^\s*(\d{1,4})(?:\s+|(?=[^\d\s]))(.+?)\s*$/);
  if (!match || /^\d{1,2}[-/.]\d/.test(afterColon)) return null;
  return { title: cleanTitle(match[2]), rawTitle: afterColon };
}

function parseNumberedReplies(text: string, defaultStatus: BookStatus, result: ImportParseResult): void {
  let current: ImportCandidate | null = null;
  let currentDate: ParsedDate = null;
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    const sourceLine = index + 1;
    if (!line) return;
    const header = numberedHeader(line);
    if (header) {
      current = candidate(`candidate-${result.candidates.length + 1}`, sourceLine, line, header.title, defaultStatus);
      addCandidate(result.candidates, current);
      currentDate = null;
      return;
    }
    const parsed = dateLine(line);
    if (parsed) { currentDate = parsed; if (parsed.warning) result.warnings.push(parsed.warning); return; }
    if (/^共\d+条回复/.test(line)) {
      result.fragments.push({ id: `fragment-${sourceLine}`, sourceLine, text: line, reason: '回复总数提示意味着可能有未复制的内容' });
      result.warnings.push(`“${line}”未展开，可能有回复未被导入`);
      return;
    }
    if (/^top\s*\d+/i.test(line) && current) {
      current.notes.push(note(`${current.id}-note-${current.notes.length + 1}`, line, line, currentDate));
      return;
    }
    if (isUiNoise(line)) return;
    if (current && currentDate && !/^\S+\s+博主\s*[:：]/.test(line)) {
      current.notes.push(note(`${current.id}-note-${current.notes.length + 1}`, line, line, currentDate));
      return;
    }
    result.fragments.push({ id: `fragment-${sourceLine}`, sourceLine, text: line, reason: current ? '没有明确的回复层级' : '无法确认书目' });
  });
}

export function parseTextImport(text: string, mode: ImportMode, defaultStatus: BookStatus): ImportParseResult {
  if (!['lines', 'blocks', 'numbered_replies'].includes(mode)) throw new Error('导入模式无效');
  if (!BOOK_STATUSES.includes(defaultStatus)) throw new Error('默认阅读状态无效');
  if (typeof text !== 'string' || !text.trim()) throw new Error('请输入要导入的文字');
  if (byteLength(text) > MAX_IMPORT_BYTES) throw new Error('导入文字不能超过 1 MiB');
  const result: ImportParseResult = { candidates: [], fragments: [], warnings: [] };
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (mode === 'lines') parseLines(normalized, defaultStatus, result);
  else if (mode === 'blocks') parseBlocks(normalized, defaultStatus, result);
  else parseNumberedReplies(normalized, defaultStatus, result);
  if (!result.candidates.length) throw new Error('没有识别到可导入的书名');
  return result;
}
