import { decodeImportUtf8, MAX_IMPORT_BYTES, MAX_IMPORT_CANDIDATES } from './textImportParser';
import type { TableCell, TableSheet } from './tableImportTypes';

const MAX_IMPORT_COLUMNS = 100;

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
