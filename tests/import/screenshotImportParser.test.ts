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

test('rejects oversized batches and more than 500 candidates', () => {
  expect(() => parseScreenshotImport(pages(['x'.repeat(1_048_577)]).pages, 'lines', 'want_to_read')).toThrow('1 MiB');
  const many = Array.from({ length: 501 }, (_, index) => `书${index + 1}`).join('\n');
  expect(() => parseScreenshotImport(pages([many]).pages, 'lines', 'want_to_read')).toThrow('500');
});

function parseScreenshotImportImport(texts: string[], continuations: boolean[]) {
  return parseScreenshotImport(pages(texts, continuations).pages, 'numbered_replies', 'finished');
}
