import type { BookStatus } from '../books/types';
import type { ImportCandidate, ImportParseResult } from './importTypes';
import { MAX_IMPORT_BYTES, MAX_IMPORT_CANDIDATES, parseTextImport, splitInformalLine } from './textImportParser';

function structuredBookLine(line: string): boolean {
  if (/^[\d]{1,3}\s*[.．、)]\s*\S/.test(line)) return true;
  if (/[|｜]/.test(line)) return true;
  if (/《[^》]+》/.test(line)) return !/[？?!！]/.test(line) && !/^(?:我觉得|也许|可能|听说|推荐|今天看)/.test(line);
  const parsed = splitInformalLine(line);
  return parsed.ratingHalfStars !== null && parsed.author !== null && !/[：:，,；;]/.test(parsed.title);
}

function possiblePlainTitle(line: string): boolean {
  return line.length <= 40 && !/[：:，,；;？！?！]/.test(line) && !/《[^》]+》/.test(line)
    && !/^(?:https?:\/\/|\d{1,2}:\d{2}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/.test(line)
    && !/^[0-5](?:\.5)?\s*(?:分|星|\/5)$/.test(line);
}

function withoutInlineChatPrefix(line: string): string {
  if (!/《[^》]+》/.test(line)) return line;
  return line.replace(/^\d{1,2}:\d{2}\s+[^：:]{1,30}[：:]\s*/, '');
}

export function extractLocalText(text: string, defaultStatus: BookStatus): ImportParseResult {
  if (!text.trim()) throw new Error('请输入要导入的文字');
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('导入文字不能超过 1 MiB');
  const entries = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
    .map((raw, index) => ({ text: raw.trim(), sourceLine: index + 1 })).filter(entry => entry.text);
  const hasStructuredBook = entries.some(entry => structuredBookLine(entry.text));
  const result: ImportParseResult = { candidates: [], fragments: [], warnings: [] };
  for (const entry of entries) {
    const content = withoutInlineChatPrefix(entry.text);
    const confident = structuredBookLine(content);
    const plainTitle = !hasStructuredBook && possiblePlainTitle(entry.text);
    if (!confident && !plainTitle) {
      result.fragments.push({ id: `fragment-${entry.sourceLine}`, sourceLine: entry.sourceLine, text: entry.text, reason: '无法确定是否是书目，请核对原文' });
      continue;
    }
    const parsed = parseTextImport(content, 'lines', defaultStatus);
    const candidate: ImportCandidate = {
      ...parsed.candidates[0],
      id: `candidate-${result.candidates.length + 1}`,
      sourceLine: entry.sourceLine,
      sourceText: entry.text,
    };
    if (content.includes('《') && candidate.author && !/(?:作者\s*[:：]|\bby\s+)/i.test(content)) {
      candidate.fieldReview = { ...candidate.fieldReview, author: '作者未标注，请核对是否确为作者' };
    }
    if (!/[《|｜]/.test(content) && candidate.author && candidate.ratingHalfStars !== null) {
      candidate.fieldReview = { ...candidate.fieldReview, title: '未标注书名，请核对是否为作品', author: '未标注作者，请核对是否为作者' };
    }
    if (/\d+\.\d+\s*分\s*$/.test(entry.text) && candidate.ratingHalfStars === null) {
      candidate.fieldReview = { ...candidate.fieldReview, title: '末尾似乎包含无效评分，请核对书名' };
    }
    result.candidates.push(candidate);
    if (result.candidates.length > MAX_IMPORT_CANDIDATES) throw new Error('一次最多导入 500 本小说');
  }
  return result;
}
