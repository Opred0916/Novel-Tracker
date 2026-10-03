import { strToU8, zipSync } from 'fflate';
import { inspectXlsxZipLimits, parseXlsxTables } from '../../src/import/tableImportParser';

function xlsxBytes(extraFiles: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'xl/workbook.xml': strToU8('<workbook xmlns:r="r"><sheets><sheet name="主表" sheetId="1" r:id="rId1"/><sheet name="第二表" sheetId="2" r:id="rId2"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>'),
    'xl/sharedStrings.xml': strToU8('<sst><si><t>书名</t></si><si><t>长夜</t></si><si><t>作者</t></si><si><t>Priest</t></si></sst>'),
    'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" s="1"><v>46000</v></c><c r="D2"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>'),
    'xl/worksheets/sheet2.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>第二表</t></is></c></row></sheetData></worksheet>'),
    'xl/styles.xml': strToU8('<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>'),
    ...extraFiles,
  });
}

test('reads sheet names, shared strings, inline strings, date cells and formula metadata', () => {
  const sheets = parseXlsxTables(xlsxBytes());
  expect(sheets.map(sheet => sheet.name)).toEqual(['主表', '第二表']);
  expect(sheets[0].rows[1].map(cell => cell.text)).toEqual(['长夜', 'Priest', '2025-12-09', '2']);
  expect(sheets[0].rows[1][2].kind).toBe('date');
  expect(sheets[0].rows[1][3].kind).toBe('formula');
});

test('rejects unsafe or oversized ZIP structures before parsing', () => {
  expect(() => inspectXlsxZipLimits(xlsxBytes({ '../escape': strToU8('x') }))).toThrow('路径');
  const manyFiles: Record<string, Uint8Array> = {};
  for (let index = 0; index < 1001; index += 1) manyFiles[`xl/extra${index}.xml`] = strToU8('x');
  expect(() => inspectXlsxZipLimits(zipSync(manyFiles))).toThrow('1000');
});
