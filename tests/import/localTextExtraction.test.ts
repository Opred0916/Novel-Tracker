import { extractLocalText } from '../../src/import/localTextExtraction';
import fs from 'node:fs';
import path from 'node:path';

test('marks an unlabeled author after a bracketed title for confirmation', () => {
  const result = extractLocalText('《默读》 Priest', 'finished');
  expect(result.candidates[0]).toMatchObject({ title: '默读', author: 'Priest', fieldReview: { author: expect.any(String) } });
});

test('preserves line numbers and source text when no confident book exists', () => {
  const result = extractLocalText('\n18:01 小A\n也许是《针锋对决》？', 'finished');
  expect(result.candidates).toEqual([]);
  expect(result.fragments).toEqual(expect.arrayContaining([
    expect.objectContaining({ sourceLine: 2, text: '18:01 小A' }),
    expect.objectContaining({ sourceLine: 3, text: '也许是《针锋对决》？' }),
  ]));
});

test('fixture: separates inline chat metadata from a book while preserving every source line', () => {
  const source = fs.readFileSync(path.join(__dirname, 'fixtures', 'mixed-local-records.txt'), 'utf8');
  const result = extractLocalText(source, 'finished');
  expect(result.candidates.map(item => [item.title, item.author, item.ratingHalfStars, item.sourceLine])).toEqual([
    ['针锋对决', '水千丞', 10, 1],
    ['火焰戎装', '水千丞', 9, 2],
  ]);
  expect(result.candidates[1].sourceText).toBe('18:01 书友A：水千丞《火焰戎装》4.5分');
  expect(result.fragments.map(item => item.text)).toEqual(['真好看，值得再读', '三体 4.3分']);
});

test('does not treat a scored reaction as certain book metadata', () => {
  const result = extractLocalText('真好看 值得读 5分', 'finished');
  expect(result.candidates[0].fieldReview).toMatchObject({ title: expect.any(String), author: expect.any(String) });
  expect(result.candidates[0].sourceText).toBe('真好看 值得读 5分');
});
