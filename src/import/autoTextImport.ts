import type { BookStatus } from '../books/types';
import type { ImportMode, ImportParseResult } from './importTypes';
import { parseTextImport } from './textImportParser';

export function detectTextImportMode(text: string): ImportMode {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.some(line => /^(?:书名|标题|title|作者|author|主角|角色|状态|status|评分|rating|作品类型|类型|type|标签|tags|摘记|想法|我的想法|备注|日期|时间|阅读记录)\s*[:：]/i.test(line))) return 'blocks';
  if (lines.some(line => /^\d{1,4}(?:\s+|(?=[^\d\s]))\S+/.test(line)) && lines.some(line => /(?:^|\D)\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(line))) return 'numbered_replies';
  return 'lines';
}

export function parseAutoTextImport(text: string, defaultStatus: BookStatus): ImportParseResult {
  return parseTextImport(text, detectTextImportMode(text), defaultStatus);
}
