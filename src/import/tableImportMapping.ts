import { BOOK_STATUSES, type BookStatus, type BookType } from '../books/types';
import type { ImportCandidate, ImportNoteDraft, ImportParseResult } from './importTypes';
import type { TableColumnMapping, TableField, TableMappingOptions, TableRowIssue, TableSheet } from './tableImportTypes';

const statusLabels: Record<string, BookStatus> = {
  want_to_read: 'want_to_read', reading: 'reading', finished: 'finished', dropped: 'dropped',
  '想读': 'want_to_read', '在读': 'reading', '阅读中': 'reading', '已读': 'finished', '读完': 'finished', '弃读': 'dropped',
};
const typeLabels: Record<string, BookType> = {
  romance_male_male: 'romance_male_male', romance_female_male: 'romance_female_male', romance_female_female: 'romance_female_female', no_romance: 'no_romance', other: 'other',
  '耽美': 'romance_male_male', '纯爱': 'romance_male_male', '言情': 'romance_female_male', BG: 'romance_female_male', GL: 'romance_female_female', '百合': 'romance_female_female', '无CP': 'no_romance', '无 CP': 'no_romance', '其他': 'other',
};

function textAt(sheet: TableSheet, row: number, column: number | undefined): string { return column === undefined ? '' : sheet.rows[row]?.[column]?.text.trim() ?? ''; }
function cellAt(sheet: TableSheet, row: number, column: number | undefined) { return column === undefined ? undefined : sheet.rows[row]?.[column]; }
function issue(rowNumber: number, field: TableField | null, rawValue: string, message: string): TableRowIssue { return { rowNumber, field, rawValue, message }; }
function dateValue(value: string): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(0); date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]) ? value : null;
}
function statusValue(value: string, fallback: BookStatus): BookStatus | null { return value ? statusLabels[value] ?? null : fallback; }
function typeValue(value: string): BookType | null { return value ? typeLabels[value] ?? null : null; }
function split(value: string, delimiter: string): string[] { return value ? value.split(delimiter || '、').map(item => item.trim()).filter(Boolean) : []; }
function tagId(value: string, tags: ReadonlyMap<string, string>): string | null {
  const direct = tags.get(value); if (direct) return direct;
  const lowered = value.toLocaleLowerCase();
  for (const [name, id] of tags.entries()) if (name.toLocaleLowerCase() === lowered || id === value) return id;
  return null;
}
function ratingValue(value: string): number | null {
  if (!value) return null;
  const number = Number(value.replace(/\s*\/\s*5$/, '').trim());
  return Number.isFinite(number) && number >= 0.5 && number <= 5 && number * 2 === Math.round(number * 2) ? Math.round(number * 2) : null;
}
function mappedColumns(mapping: TableColumnMapping): number[] { return Object.values(mapping).filter((value): value is number => value !== undefined); }

export function validateTableMapping(sheet: TableSheet, mapping: TableColumnMapping, options: TableMappingOptions): TableRowIssue[] {
  const issues: TableRowIssue[] = [];
  if (!BOOK_STATUSES.includes(options.defaultStatus)) issues.push(issue(0, 'status', '', '默认阅读状态无效'));
  if (mapping.title === undefined) issues.push(issue(0, 'title', '', '必须对应书名列'));
  const seen = new Set<number>();
  for (const column of mappedColumns(mapping)) {
    if (seen.has(column)) issues.push(issue(0, null, '', '一列不能对应多个字段'));
    seen.add(column);
    if (column < 0 || column >= Math.max(...sheet.rows.map(row => row.length), 0)) issues.push(issue(0, null, '', '列位置无效'));
  }
  const maxColumns = Math.max(...sheet.rows.map(row => row.length), 0);
  for (let column = 0; column < maxColumns; column += 1) {
    if (!seen.has(column) && !options.ignoredColumns.includes(column)) issues.push(issue(options.hasHeader ? 1 : 0, null, '', '有未对应的列需要确认忽略'));
  }
  const firstDataRow = options.hasHeader ? 1 : 0;
  for (let row = firstDataRow; row < sheet.rows.length; row += 1) {
    const rowNumber = row + 1;
    if (options.skippedRows.includes(rowNumber)) continue;
    const values = sheet.rows[row] ?? [];
    const nonblank = values.some(item => item.text.trim());
    if (!nonblank) continue;
    const title = textAt(sheet, row, mapping.title);
    if (!title) { issues.push(issue(rowNumber, 'title', '', '书名不能为空；请补充书名或明确跳过此行')); continue; }
    for (const [field, column] of Object.entries(mapping) as [TableField, number][]) {
      const raw = textAt(sheet, row, column);
      const cell = cellAt(sheet, row, column);
      if (cell?.kind === 'formula') issues.push(issue(rowNumber, field, raw, '公式单元格不能自动导入，请改填为文字或数字'));
      if (field === 'status' && raw && !statusLabels[raw]) issues.push(issue(rowNumber, field, raw, '阅读状态无法识别'));
      if (field === 'rating' && raw && ratingValue(raw) === null) issues.push(issue(rowNumber, field, raw, '评分必须是 0.5 到 5，并以半星递增'));
      if (field === 'bookType' && raw && typeValue(raw) === null) issues.push(issue(rowNumber, field, raw, '作品类型无法识别'));
      if ((field === 'startedOn' || field === 'endedOn' || field === 'noteRecordedOn') && raw && dateValue(raw) === null && /\d/.test(raw)) issues.push(issue(rowNumber, field, raw, '日期必须是有效的 YYYY-MM-DD'));
      if (field === 'tags' && raw) for (const tag of split(raw, options.tagDelimiter)) if (!tagId(tag, options.tagIdsByName)) issues.push(issue(rowNumber, field, tag, `标签不存在：${tag}`));
    }
    const status = statusValue(textAt(sheet, row, mapping.status), options.defaultStatus);
    const rating = ratingValue(textAt(sheet, row, mapping.rating));
    if (rating !== null && status !== 'finished') issues.push(issue(rowNumber, 'rating', textAt(sheet, row, mapping.rating), '只有读完书籍可以填写评分'));
  }
  return issues;
}

function candidateFromRow(sheet: TableSheet, row: number, mapping: TableColumnMapping, options: TableMappingOptions): ImportCandidate {
  const sourceLine = row + 1;
  const id = `table-candidate-${sourceLine}`;
  const status = statusValue(textAt(sheet, row, mapping.status), options.defaultStatus)!;
  const notes: ImportNoteDraft[] = [];
  const noteBody = textAt(sheet, row, mapping.note);
  if (noteBody) notes.push({ id: `${id}-note-1`, body: noteBody, sourceText: sheet.rows[row].map(cell => cell.text).join(', '), originalRecordedOn: dateValue(textAt(sheet, row, mapping.noteRecordedOn)), originalRecordedTime: null });
  const startedOn = dateValue(textAt(sheet, row, mapping.startedOn));
  const endedOn = dateValue(textAt(sheet, row, mapping.endedOn));
  return {
    id, sourceLine, sourceText: sheet.rows[row].map(cell => cell.text).join(', '), title: textAt(sheet, row, mapping.title),
    author: textAt(sheet, row, mapping.author) || null, protagonists: split(textAt(sheet, row, mapping.protagonists), options.protagonistDelimiter), status,
    ratingHalfStars: status === 'finished' ? ratingValue(textAt(sheet, row, mapping.rating)) : null, bookType: typeValue(textAt(sheet, row, mapping.bookType)),
    tagIds: split(textAt(sheet, row, mapping.tags), options.tagDelimiter).map(tag => tagId(tag, options.tagIdsByName)!).filter(Boolean),
    sessions: status === 'want_to_read' ? [] : [{ ordinal: 1, outcome: status, startedOn, endedOn: status === 'reading' ? null : endedOn }], notes,
    whyWantToRead: textAt(sheet, row, mapping.whyWantToRead) || null, platform: textAt(sheet, row, mapping.platform) || null,
  };
}

export function mapTableToImport(sheet: TableSheet, mapping: TableColumnMapping, options: TableMappingOptions): ImportParseResult {
  const issues = validateTableMapping(sheet, mapping, options);
  if (issues.length) throw new Error(`表格预览未通过：${issues[0].message}`);
  const candidates = [] as ImportCandidate[];
  for (let row = options.hasHeader ? 1 : 0; row < sheet.rows.length; row += 1) {
    if (options.skippedRows.includes(row + 1) || !sheet.rows[row]?.some(cell => cell.text.trim())) continue;
    candidates.push(candidateFromRow(sheet, row, mapping, options));
  }
  if (!candidates.length) throw new Error('没有识别到可导入的书名');
  return { candidates, fragments: [], warnings: [] };
}
