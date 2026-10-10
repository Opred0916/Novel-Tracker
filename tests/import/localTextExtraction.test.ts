import { extractLocalText } from '../../src/import/localTextExtraction';

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
