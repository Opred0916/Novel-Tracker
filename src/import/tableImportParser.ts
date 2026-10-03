import { strFromU8, unzipSync } from 'fflate';
import { decodeImportUtf8, MAX_IMPORT_BYTES, MAX_IMPORT_CANDIDATES } from './textImportParser';
import type { TableCell, TableSheet } from './tableImportTypes';

const MAX_IMPORT_COLUMNS = 100;
export const MAX_XLSX_BYTES = 5 * 1024 * 1024;
export const MAX_XLSX_ENTRIES = 1000;
export const MAX_XLSX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;

function columnName(index: number): string {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function cell(text: string, row: number, column: number): TableCell {
  return { text, kind: 'text', sourceAddress: `${columnName(column)}${row + 1}` };
}

export function parseCsvTable(bytes: Uint8Array, delimiter: ',' | ';' | '\t'): TableSheet {
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new Error('CSV 文件不能超过 1 MiB');
  const text = decodeImportUtf8(bytes);
  const rows: TableCell[][] = [];
  let current: string[] = [];
  let value = '';
  let quoted = false;
  let afterQuote = false;

  const pushCell = () => { current.push(value); value = ''; afterQuote = false; };
  const pushRow = () => {
    pushCell();
    if (current.length > MAX_IMPORT_COLUMNS) throw new Error('CSV 列数不能超过 100 列');
    rows.push(current.map((item, index) => cell(item, rows.length, index)));
    current = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { value += '"'; index += 1; }
        else { quoted = false; afterQuote = true; }
      } else value += character;
      continue;
    }
    if (afterQuote) {
      if (character === delimiter) { pushCell(); continue; }
      if (character === '\n') { pushRow(); continue; }
      if (character === '\r') { if (text[index + 1] === '\n') index += 1; pushRow(); continue; }
      if (character === ' ' || character === '\t') continue;
      throw new Error('CSV 引号格式无效');
    }
    if (character === '"') {
      if (value.length !== 0) throw new Error('CSV 引号格式无效');
      quoted = true;
    } else if (character === delimiter) pushCell();
    else if (character === '\n') pushRow();
    else if (character === '\r') { if (text[index + 1] === '\n') index += 1; pushRow(); }
    else value += character;
  }
  if (quoted) throw new Error('CSV 引号格式无效');
  if (value.length > 0 || current.length > 0) pushRow();
  const nonEmptyRows = rows.filter(row => row.some(item => item.text.trim())).length;
  if (nonEmptyRows > MAX_IMPORT_CANDIDATES + 1) throw new Error('一次最多处理 500 条数据行');
  return { name: 'CSV', rows };
}

function u16(bytes: Uint8Array, offset: number): number { return bytes[offset] | (bytes[offset + 1] << 8); }
function u32(bytes: Uint8Array, offset: number): number { return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0; }
function xmlAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1] ?? null;
}
function xmlUnescape(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function xmlText(value: string): string {
  return [...value.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(match => xmlUnescape(match[1])).join('');
}
function safeZipPath(name: string): boolean { return name.length > 0 && !name.includes('\\') && !name.split('/').some(part => part === '..' || part === '.') && !name.startsWith('/'); }

export function inspectXlsxZipLimits(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_XLSX_BYTES) throw new Error('XLSX 文件不能超过 5 MiB');
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (u32(bytes, index) === 0x06054b50) { end = index; break; }
  }
  if (end < 0) throw new Error('XLSX ZIP 结构无效');
  const entryCount = u16(bytes, end + 10);
  const directorySize = u32(bytes, end + 12);
  const directoryOffset = u32(bytes, end + 16);
  if (entryCount > MAX_XLSX_ENTRIES || directoryOffset + directorySize > bytes.length) throw new Error('XLSX 条目超过 1000 个或目录无效');
  let offset = directoryOffset;
  let declaredTotal = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (u32(bytes, offset) !== 0x02014b50) throw new Error('XLSX ZIP 目录无效');
    const flags = u16(bytes, offset + 8);
    const uncompressed = u32(bytes, offset + 24);
    const nameLength = u16(bytes, offset + 28);
    const extraLength = u16(bytes, offset + 30);
    const commentLength = u16(bytes, offset + 32);
    const name = strFromU8(bytes.slice(offset + 46, offset + 46 + nameLength));
    if ((flags & 1) !== 0 || !safeZipPath(name)) throw new Error(`XLSX 路径或加密标志无效：${name}`);
    declaredTotal += uncompressed;
    if (declaredTotal > MAX_XLSX_UNCOMPRESSED_BYTES) throw new Error('XLSX 声明解压大小超过 25 MiB');
    offset += 46 + nameLength + extraLength + commentLength;
  }
}

function excelDate(serial: number): string {
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function parseWorksheet(xml: string, sharedStrings: string[], sheetName: string, dateStyleIndexes: ReadonlySet<number>): TableSheet {
  const rows: TableCell[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: TableCell[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const header = cellMatch[1];
      const ref = xmlAttribute(header, 'r') ?? `${columnName(cells.length)}${rows.length + 1}`;
      const columnLetters = ref.match(/^[A-Z]+/i)?.[0] ?? columnName(cells.length);
      let column = 0; for (const character of columnLetters.toUpperCase()) column = column * 26 + character.charCodeAt(0) - 64; column -= 1;
      while (cells.length < column) cells.push(cell('', rows.length, cells.length));
      const body = cellMatch[2];
      const type = xmlAttribute(header, 't');
      const style = Number(xmlAttribute(header, 's') ?? -1);
      const formula = /<f(?:\s[^>]*)?>[\s\S]*?<\/f>/.test(body);
      const raw = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1] ?? '';
      let text = type === 's' ? (sharedStrings[Number(raw)] ?? '') : type === 'inlineStr' ? xmlText(body) : xmlUnescape(raw);
      const kind: TableCell['kind'] = formula ? 'formula' : dateStyleIndexes.has(style) && text !== '' && Number.isFinite(Number(text)) ? 'date' : type === 'n' && text !== '' ? 'number' : 'text';
      if (kind === 'date') text = excelDate(Number(text));
      cells[column] = { text, kind, sourceAddress: ref };
    }
    rows.push(cells);
  }
  return { name: sheetName, rows };
}

export function parseXlsxTables(bytes: Uint8Array): TableSheet[] {
  inspectXlsxZipLimits(bytes);
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { throw new Error('XLSX 文件损坏或无法解压'); }
  const actualTotal = Object.values(files).reduce((sum, file) => sum + file.byteLength, 0);
  if (Object.keys(files).length > MAX_XLSX_ENTRIES || actualTotal > MAX_XLSX_UNCOMPRESSED_BYTES) throw new Error('XLSX 实际解压大小超过 25 MiB');
  const workbook = strFromU8(files['xl/workbook.xml'] ?? new Uint8Array());
  const relationships = strFromU8(files['xl/_rels/workbook.xml.rels'] ?? new Uint8Array());
  if (!workbook || !relationships) throw new Error('XLSX 缺少工作簿信息');
  const sharedStrings = [...strFromU8(files['xl/sharedStrings.xml'] ?? new Uint8Array()).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => xmlText(match[1]));
  const styleXml = strFromU8(files['xl/styles.xml'] ?? new Uint8Array());
  const dateStyleIndexes = new Set<number>();
  const xfs = styleXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
  [...xfs.matchAll(/<xf\b([^>]*)\/?>(?:<\/xf>)?/g)].forEach((match, index) => { const id = Number(xmlAttribute(match[1], 'numFmtId')); if ((id >= 14 && id <= 22) || /[dmyhs]/i.test(xmlAttribute(match[1], 'formatCode') ?? '')) dateStyleIndexes.add(index); });
  const sheets: TableSheet[] = [];
  for (const match of workbook.matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g)) {
    const header = match[1];
    const name = xmlUnescape(xmlAttribute(header, 'name') ?? `Sheet${sheets.length + 1}`);
    const relationId = xmlAttribute(header, 'r:id') ?? xmlAttribute(header, 'id');
    const relationship = [...relationships.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g)].find(item => xmlAttribute(item[1], 'Id') === relationId);
    const target = relationship ? xmlAttribute(relationship[1], 'Target') : `worksheets/sheet${sheets.length + 1}.xml`;
    const path = target?.startsWith('/') ? target.slice(1) : `xl/${target ?? `worksheets/sheet${sheets.length + 1}.xml`}`;
    const sheetXml = strFromU8(files[path] ?? new Uint8Array());
    if (!sheetXml) throw new Error(`XLSX 缺少工作表：${name}`);
    sheets.push(parseWorksheet(sheetXml, sharedStrings, name, dateStyleIndexes));
  }
  if (!sheets.length) throw new Error('XLSX 没有工作表');
  return sheets;
}
