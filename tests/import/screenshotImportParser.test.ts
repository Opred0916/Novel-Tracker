import fs from 'node:fs';
import path from 'node:path';
import { createScreenshotDraft } from '../../src/import/screenshotImportDraft';
import { parseScreenshotImport } from '../../src/import/screenshotImportParser';

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'weibo-screenshot-ocr.txt'), 'utf8');

function pages(texts: string[], continuations: boolean[] = []) {
  const result = createScreenshotDraft(texts.map((_, index) => `file:///page-${index + 1}.png`), (() => {
    let index = 0;
    return () => `page-${++index}`;
  })());
  return { ...result, pages: result.pages.map((page, index) => ({ ...page, text: texts[index], ocrState: 'recognized' as const, continuesPrevious: continuations[index] ?? false })) };
}

test('parses each independent screenshot conservatively and keeps reply fragments traceable', () => {
  const [first, second] = fixture.split(/\n\s*\n/);
  const result = parseScreenshotImport(pages([first, second]).pages, 'numbered_replies', 'finished');

  expect(result.candidates.map(candidate => candidate.title)).toEqual(['残次品', '重生之释然']);
  expect(result.fragments.map(fragment => fragment.text)).toEqual(['top1', 'top3', '重生之豁然', '好喜欢他们']);
  expect(result.fragments[0]).toMatchObject({ sourceRef: { kind: 'screenshot', pageId: 'page-1', line: 3 }, recordedAtHint: '24-10-27 12:12' });
  expect(result.fragments[2].sourceRef).toEqual({ kind: 'screenshot', pageId: 'page-2', line: 3 });
  expect(result.warnings).toEqual(expect.arrayContaining(['“共4条回复”未展开，可能有回复未被导入', '“共6条回复”未展开，可能有回复未被导入']));
  expect(result.fragments.map(fragment => fragment.text)).not.toEqual(expect.arrayContaining(['Purani_ 博主', '来自 江苏', '点赞 1']));
});

test('only an explicit continuation lets the next screenshot share the previous parse group', () => {
  const independent = parseScreenshotImportImport(['144残次品\n24-10-27 12:12', 'Purani_ 博主：top1\n24-10-28 23:25'], [false, false]);
  const continued = parseScreenshotImportImport(['144残次品\n24-10-27 12:12', 'Purani_ 博主：top1\n24-10-28 23:25'], [false, true]);

  expect(independent.fragments[0]).toMatchObject({ text: 'top1', sourceRef: { pageId: 'page-2' } });
  expect(continued.fragments[0]).toMatchObject({ text: 'top1', sourceRef: { pageId: 'page-2' } });
  expect(independent.candidates).toHaveLength(1);
  expect(continued.candidates).toHaveLength(1);
});

test('supports explicit line and field-block modes without inventing dates', () => {
  const lines = parseScreenshotImport(pages(['中文书名\nEnglish Title']).pages, 'lines', 'want_to_read');
  const blocks = parseScreenshotImport(pages(['书名：星际旅人\n作者：作者甲\n摘记：完整日期也先待确认\n日期：2024-01-02']).pages, 'blocks', 'finished');

  expect(lines.candidates.map(candidate => candidate.title)).toEqual(['中文书名', 'English Title']);
  expect(blocks.candidates[0]).toMatchObject({ title: '星际旅人', author: '作者甲', sourceRef: { pageId: 'page-1', line: 1 } });
  expect(blocks.candidates[0].notes[0]).toMatchObject({ body: '完整日期也先待确认', originalRecordedOn: null, recordedAtHint: '2024-01-02', sourceRef: { pageId: 'page-1', line: 3 } });
});

test('extracts author title and score from recognized screenshot lines', () => {
  const result = parseScreenshotImport(pages(['水千丞 针锋对决 5分\n《火焰戎装》 水千丞 4.5分']).pages, 'lines', 'finished');
  expect(result.candidates.map(item => [item.author, item.title, item.ratingHalfStars])).toEqual([
    ['水千丞', '针锋对决', 10],
    ['水千丞', '火焰戎装', 9],
  ]);
});

test('keeps adjacent labeled screenshot records as separate books', () => {
  const result = parseScreenshotImport(pages(['书名：第一本\n作者：作者甲\n书名：第二本\n作者：作者乙']).pages, 'blocks', 'want_to_read');
  expect(result.candidates.map(item => [item.title, item.author])).toEqual([['第一本', '作者甲'], ['第二本', '作者乙']]);
});

test('keeps blank-line separated field blocks as separate candidates', () => {
  const result = parseScreenshotImport(pages(['书名：第一本\n作者：作者甲\n\n书名：第二本\n作者：作者乙']).pages, 'blocks', 'want_to_read');

  expect(result.candidates.map(candidate => [candidate.title, candidate.author])).toEqual([['第一本', '作者甲'], ['第二本', '作者乙']]);
});

test('rejects oversized batches and more than 500 candidates', () => {
  expect(() => parseScreenshotImport(pages(['x'.repeat(1_048_577)]).pages, 'lines', 'want_to_read')).toThrow('1 MiB');
  const many = Array.from({ length: 501 }, (_, index) => `书${index + 1}`).join('\n');
  expect(() => parseScreenshotImport(pages([many]).pages, 'lines', 'want_to_read')).toThrow('500');
});

test('auto screenshot mode preserves page provenance and does not move a loose score to the next book', () => {
  const result = parseScreenshotImport(pages(['《针锋对决》 水千丞\n5分', '《火焰戎装》 水千丞 4.5分'], [false, true]).pages, null, 'finished');
  expect(result.candidates.map(item => [item.title, item.ratingHalfStars, item.sourceRef])).toEqual([
    ['针锋对决', null, { kind: 'screenshot', pageId: 'page-1', line: 1 }],
    ['火焰戎装', 9, { kind: 'screenshot', pageId: 'page-2', line: 1 }],
  ]);
  expect(result.fragments).toEqual(expect.arrayContaining([
    expect.objectContaining({ text: '5分', sourceRef: { kind: 'screenshot', pageId: 'page-1', line: 2 } }),
  ]));
});

test('auto screenshot mode retains unreadable source as fragments instead of throwing', () => {
  const result = parseScreenshotImport(pages(['18:01 小A\n也许是《针锋对决》？']).pages, null, 'want_to_read');
  expect(result.candidates).toEqual([]);
  expect(result.fragments.map(item => item.text)).toEqual(['18:01 小A', '也许是《针锋对决》？']);
});

test('auto screenshot mode still recognizes labeled blocks and numbered replies', () => {
  const block = parseScreenshotImport(pages(['书名：第一本\n作者：作者甲']).pages, null, 'finished');
  const numbered = parseScreenshotImport(pages([fixture.split(/\n\s*\n/)[0]]).pages, null, 'finished');
  expect(block.candidates[0]).toMatchObject({ title: '第一本', author: '作者甲' });
  expect(numbered.candidates[0].title).toBe('残次品');
  expect(numbered.fragments.some(item => item.text === 'top1')).toBe(true);
});

test('auto screenshot blocks keep complete source and expose titleless lines for review', () => {
  const result = parseScreenshotImport(pages(['作者：孤立\n\n书名：第一本\n作者：甲\n评分：4.3分']).pages, null, 'finished');
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0].sourceText).toContain('作者：甲');
  expect(result.candidates[0].fieldReview?.ratingHalfStars).toBeTruthy();
  expect(result.fragments.map(item => item.text)).toContain('作者：孤立');
});

test('auto numbered screenshots preserve date and interface lines as reviewable evidence', () => {
  const result = parseScreenshotImport(pages(['小A 博主：1第一本\n24-10-27 12:12 来自 江苏\n点赞 2\n小A 博主：一条想法']).pages, null, 'finished');
  expect(result.candidates[0].title).toBe('第一本');
  expect(result.fragments.map(item => item.text)).toEqual(expect.arrayContaining(['24-10-27 12:12 来自 江苏', '点赞 2']));
});

function parseScreenshotImportImport(texts: string[], continuations: boolean[]) {
  return parseScreenshotImport(pages(texts, continuations).pages, 'numbered_replies', 'finished');
}
