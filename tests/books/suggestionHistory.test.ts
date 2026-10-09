import { createSuggestionHistory, MAX_SUGGESTIONS } from '../../src/books/suggestionHistory';

test('seeds once, keeps recent unique values with a cap, and does not resurrect removed records', async () => {
  const entries = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => entries.get(key) ?? null,
    setItem: async (key: string, value: string) => { entries.set(key, value); },
  };
  const history = createSuggestionHistory(storage);
  expect(await history.list('author', ['甲', '乙', '甲'])).toEqual(['甲', '乙']);
  await history.remove('author', '甲');
  expect(await history.list('author', ['甲', '乙'])).toEqual(['乙']);
  for (let index = 0; index < MAX_SUGGESTIONS + 2; index++) await history.remember('author', `作者${index}`);
  expect((await history.list('author')).length).toBe(MAX_SUGGESTIONS);
  expect(await history.list('author')).not.toContain('作者0');
  await history.remember('author', '作者3');
  expect((await history.list('author'))[0]).toBe('作者3');
  expect(await history.list('platform', ['晋江'])).toEqual(['晋江']);
});
