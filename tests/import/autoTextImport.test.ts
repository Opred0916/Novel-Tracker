import { parseAutoTextImport } from '../../src/import/autoTextImport';

test('recognizes detailed book blocks without choosing a format first', () => {
  const result = parseAutoTextImport('书名：第一本\n作者：甲\n状态：已读\n\n书名：第二本\n作者：乙', 'finished');
  expect(result.candidates.map(item => [item.title, item.author])).toEqual([['第一本', '甲'], ['第二本', '乙']]);
});

test('recognizes plain one-title-per-line lists', () => {
  const result = parseAutoTextImport('第一本\n第二本\n第三本', 'want_to_read');
  expect(result.candidates.map(item => item.title)).toEqual(['第一本', '第二本', '第三本']);
});

test('recognizes numbered records and keeps uncertain lines for review', () => {
  const result = parseAutoTextImport('未分类的文字\n1 第一本\n2026-10-01\n读后感\n2 第二本', 'finished');
  expect(result.candidates.map(item => item.title)).toEqual(['第一本', '第二本']);
  expect(result.fragments.some(item => item.text === '未分类的文字')).toBe(true);
});
