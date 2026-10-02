import { buildNoteSnippet, escapeLikeTerm, normalizeSearchTerms } from '../../src/books/bookSearch';

test('normalizes whitespace and lowercases search terms without reordering them', () => {
  expect(normalizeSearchTerms('  Priest   重读\n顾昀  ')).toEqual(['priest', '重读', '顾昀']);
  expect(normalizeSearchTerms('   ')).toEqual([]);
});

test('escapes sqlite LIKE control characters as literal text', () => {
  expect(escapeLikeTerm(String.raw`50%_完成\记录`)).toBe(String.raw`50\%\_完成\\记录`);
});

test('builds a short note snippet around the matched term', () => {
  const body = '开头内容很长很长，继续补充一些文字，终于出现重读这个关键词，后面还有很多很多的阅读想法和结尾。';
  const snippet = buildNoteSnippet(body, '重读', 24);
  expect(snippet.length).toBeLessThanOrEqual(26);
  expect(snippet).toContain('重读');
  expect(snippet.startsWith('…')).toBe(true);
  expect(snippet.endsWith('…')).toBe(true);
});

test('does not add ellipses when the full note fits', () => {
  expect(buildNoteSnippet('值得重读', '重读', 60)).toBe('值得重读');
});
