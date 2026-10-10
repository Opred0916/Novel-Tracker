import { parseAutoTextImport } from '../../src/import/autoTextImport';

test('keeps a titleless field block as reviewable source instead of inventing a book', () => {
  const result = parseAutoTextImport('作者：甲\n评分：4.3分', 'finished');
  expect(result.candidates).toEqual([]);
  expect(result.fragments.map(item => item.text)).toEqual(['作者：甲', '评分：4.3分']);
});

test('flags an invalid explicit score in a titled block', () => {
  const result = parseAutoTextImport('书名：甲\n评分：4.3分', 'finished');
  expect(result.candidates[0].fieldReview?.ratingHalfStars).toBeTruthy();
  expect(result.candidates[0].ratingHalfStars).toBeNull();
});

test('recognizes detailed book blocks without choosing a format first', () => {
  const result = parseAutoTextImport('书名：第一本\n作者：甲\n状态：已读\n\n书名：第二本\n作者：乙', 'finished');
  expect(result.candidates.map(item => [item.title, item.author])).toEqual([['第一本', '甲'], ['第二本', '乙']]);
});

test('recognizes plain one-title-per-line lists', () => {
  const result = parseAutoTextImport('第一本\n第二本\n第三本', 'want_to_read');
  expect(result.candidates.map(item => item.title)).toEqual(['第一本', '第二本', '第三本']);
});

test('recognizes author title and rating in a pasted reading list', () => {
  const result = parseAutoTextImport('水千丞 针锋对决 5分\n水千丞 火焰戎装 5分', 'finished');
  expect(result.candidates.map(item => [item.author, item.title, item.ratingHalfStars, item.sourceText])).toEqual([
    ['水千丞', '针锋对决', 10, '水千丞 针锋对决 5分'],
    ['水千丞', '火焰戎装', 10, '水千丞 火焰戎装 5分'],
  ]);
});

test('recognizes bracketed titles with either author order and rating', () => {
  const result = parseAutoTextImport('《针锋对决》 水千丞 5分\n水千丞《火焰戎装》4.5分', 'finished');
  expect(result.candidates.map(item => [item.author, item.title, item.ratingHalfStars])).toEqual([
    ['水千丞', '针锋对决', 10],
    ['水千丞', '火焰戎装', 9],
  ]);
});

test('recognizes numbered records and keeps uncertain lines for review', () => {
  const result = parseAutoTextImport('未分类的文字\n1 第一本\n2026-10-01\n读后感\n2 第二本', 'finished');
  expect(result.candidates.map(item => item.title)).toEqual(['第一本', '第二本']);
  expect(result.fragments.some(item => item.text === '未分类的文字')).toBe(true);
});

test('starts a new book at each labeled title even without blank lines', () => {
  const result = parseAutoTextImport('书名：针锋对决\n作者：水千丞\n评分：5分\n书名：火焰戎装\n作者：水千丞\n评分：4.5分', 'finished');
  expect(result.candidates.map(item => [item.title, item.author, item.ratingHalfStars, item.sourceLine])).toEqual([
    ['针锋对决', '水千丞', 10, 1],
    ['火焰戎装', '水千丞', 9, 4],
  ]);
  expect(result.candidates[0].sourceText).toBe('书名：针锋对决\n作者：水千丞\n评分：5分');
});

test('reads multiple labeled fields on each line as separate books', () => {
  const result = parseAutoTextImport('作者：水千丞 书名：针锋对决 评分：5分\n书名：火焰戎装；作者：水千丞；评分：4.5/5', 'finished');
  expect(result.candidates.map(item => [item.title, item.author, item.ratingHalfStars])).toEqual([
    ['针锋对决', '水千丞', 10],
    ['火焰戎装', '水千丞', 9],
  ]);
});

test('does not split a note just because it mentions a labeled-looking word', () => {
  const result = parseAutoTextImport('书名：第一本\n摘记：我喜欢作者：甲的写法', 'finished');
  expect(result.candidates[0].author).toBeNull();
  expect(result.candidates[0].notes[0].body).toBe('我喜欢作者：甲的写法');
});

test('reads numbered informal lists and several explicit score styles', () => {
  const result = parseAutoTextImport('1. 水千丞《针锋对决》评分：5\n2、 《火焰戎装》 水千丞 4.5星\n《残次品》 by Priest（评分：4.5/5）', 'finished');
  expect(result.candidates.map(item => [item.title, item.author, item.ratingHalfStars])).toEqual([
    ['针锋对决', '水千丞', 10],
    ['火焰戎装', '水千丞', 9],
    ['残次品', 'Priest', 9],
  ]);
});

test('reads score units in pipe-separated lists and keeps invalid decimals for review', () => {
  const result = parseAutoTextImport('第一本｜作者甲｜已读｜5分\n第二本｜作者乙｜已读｜4.5/5\n三体 4.3分', 'finished');
  expect(result.candidates.map(item => [item.title, item.ratingHalfStars])).toEqual([
    ['第一本', 10], ['第二本', 9],
  ]);
  expect(result.fragments.map(item => item.text)).toContain('三体 4.3分');
});

test('keeps social metadata and free-form reactions out of book fields', () => {
  const result = parseAutoTextImport('18:01 小A\n《针锋对决》 水千丞 5分\n真好看\n18:02 小B\n《火焰戎装》 水千丞 4.5分', 'finished');
  expect(result.candidates.map(item => [item.title, item.author, item.ratingHalfStars, item.sourceLine])).toEqual([
    ['针锋对决', '水千丞', 10, 2],
    ['火焰戎装', '水千丞', 9, 5],
  ]);
  expect(result.fragments.map(item => item.text)).toEqual(['18:01 小A', '真好看', '18:02 小B']);
});

test('keeps field-like words inside a free-form thought as undecided source', () => {
  const result = parseAutoTextImport('这段感想里提到作者：甲，评分：5分', 'finished');
  expect(result.candidates).toEqual([]);
  expect(result.fragments[0].text).toBe('这段感想里提到作者：甲，评分：5分');
});

test('does not assert a book from an uncertain mention of a bracketed title', () => {
  const result = parseAutoTextImport('也许是《针锋对决》？', 'finished');
  expect(result.candidates).toEqual([]);
  expect(result.fragments[0].text).toBe('也许是《针锋对决》？');
});
