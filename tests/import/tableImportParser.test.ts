import { parseCsvTable } from '../../src/import/tableImportParser';

test('parses BOM, quoted commas, delimiters, embedded newlines, and emoji', () => {
  const sheet = parseCsvTable(new TextEncoder().encode('\uFEFF书名,作者,想法\r\n"长夜,一",Priest,"第一行\n第二行 😀"\r\n'), ',');
  expect(sheet.name).toBe('CSV');
  expect(sheet.rows.map(row => row.map(cell => cell.text))).toEqual([
    ['书名', '作者', '想法'], ['长夜,一', 'Priest', '第一行\n第二行 😀'],
  ]);
  expect(sheet.rows[1][0].sourceAddress).toBe('A2');
});

test('supports semicolon and tab delimiters without splitting quoted delimiters', () => {
  expect(parseCsvTable(new TextEncoder().encode('书名;标签\n长夜;"仙侠;架空"'), ';').rows[1].map(cell => cell.text))
    .toEqual(['长夜', '仙侠;架空']);
  expect(parseCsvTable(new TextEncoder().encode('书名\t作者\n长夜\tPriest'), '\t').rows[1].map(cell => cell.text))
    .toEqual(['长夜', 'Priest']);
});

test.each([
  ['unclosed quote', '书名,作者\n"长夜,Priest'],
  ['quote in unquoted cell', '书名,作者\n长"夜,Priest'],
])('rejects %s', (_name, csv) => {
  expect(() => parseCsvTable(new TextEncoder().encode(csv), ',')).toThrow('CSV');
});

test('rejects invalid UTF-8 and oversized tables', () => {
  expect(() => parseCsvTable(new Uint8Array([0xc3, 0x28]), ',')).toThrow('UTF-8');
  const rows = ['书名', ...Array.from({ length: 501 }, (_, index) => `书${index}`)].join('\n');
  expect(() => parseCsvTable(new TextEncoder().encode(rows), ',')).toThrow('500');
});
