import { mapTableToImport, validateTableMapping } from '../../src/import/tableImportMapping';
import { parseCsvTable } from '../../src/import/tableImportParser';
import type { TableColumnMapping, TableMappingOptions } from '../../src/import/tableImportTypes';

const options: TableMappingOptions = {
  hasHeader: true, defaultStatus: 'want_to_read', ignoredColumns: [], skippedRows: [],
  protagonistDelimiter: '、', tagDelimiter: '、', tagIdsByName: new Map([['仙侠', 'tag-x']]),
};

test('requires a title mapping and rejects duplicate target columns or unacknowledged columns', () => {
  const sheet = parseCsvTable(new TextEncoder().encode('书名,作者,无关\n长夜,Priest,x'), ',');
  expect(validateTableMapping(sheet, { author: 0 }, options).map(issue => issue.message)).toEqual(expect.arrayContaining([
    '必须对应书名列', '有未对应的列需要确认忽略',
  ]));
  expect(validateTableMapping(sheet, { title: 0, author: 0 }, { ...options, ignoredColumns: [2] })
    .some(issue => issue.message === '一列不能对应多个字段')).toBe(true);
});

test('reports invalid row values and maps a valid row into one import candidate', () => {
  const sheet = parseCsvTable(new TextEncoder().encode([
    '书名,作者,主角,状态,评分,标签,开始日期,结束日期,我的想法,为什么想看,平台',
    '长夜,Priest,阿青、长庚,已读,4.5,仙侠,2026-09-01,2026-09-03,读完很喜欢,朋友推荐,晋江',
    ',作者,,,,,,,,',
    '坏评分,作者,,已读,4.7,,,,,,' ,
    '坏日期,作者,,读完,5,,2026-02-30,,,,',
  ].join('\n')), ',');
  const mapping: TableColumnMapping = { title: 0, author: 1, protagonists: 2, status: 3, rating: 4, tags: 5, startedOn: 6, endedOn: 7, note: 8, whyWantToRead: 9, platform: 10 };
  const issues = validateTableMapping(sheet, mapping, options);
  expect(issues.map(issue => issue.rowNumber)).toEqual(expect.arrayContaining([3, 4, 5]));
  const validSheet = { ...sheet, rows: sheet.rows.slice(0, 2) };
  const result = mapTableToImport(validSheet, mapping, { ...options, tagIdsByName: new Map([['仙侠', 'tag-x']]) });
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]).toMatchObject({
    title: '长夜', author: 'Priest', protagonists: ['阿青', '长庚'], status: 'finished', ratingHalfStars: 9,
    tagIds: ['tag-x'], whyWantToRead: '朋友推荐', platform: '晋江',
  });
  expect(result.candidates[0].sessions).toEqual([{ ordinal: 1, outcome: 'finished', startedOn: '2026-09-01', endedOn: '2026-09-03' }]);
  expect(result.candidates[0].notes[0]).toMatchObject({ body: '读完很喜欢', originalRecordedOn: null });
});

test('maps a non-finished row without a rating and keeps unknown dates null', () => {
  const sheet = parseCsvTable(new TextEncoder().encode('书名,状态,评分,开始日期\n长夜,在读,,不确定'), ',');
  const mapping: TableColumnMapping = { title: 0, status: 1, rating: 2, startedOn: 3 };
  const result = mapTableToImport(sheet, mapping, { ...options, ignoredColumns: [] });
  expect(result.candidates[0].sessions).toEqual([{ ordinal: 1, outcome: 'reading', startedOn: null, endedOn: null }]);
});
