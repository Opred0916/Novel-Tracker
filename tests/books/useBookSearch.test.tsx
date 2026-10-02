import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useBookSearch } from '../../src/books/useBookSearch';
import type { BookSearchFilters, BookSearchResult } from '../../src/books/bookSearch';

const filters = (query: string): BookSearchFilters => ({ query, status: null, bookType: null, tagIds: [] });
const result = (id: string): BookSearchResult => ({
  book: { id, title: id, author: null, status: 'want_to_read', protagonists: [], ratingHalfStars: null, bookType: null, tags: [], legacyReadCount: 0, createdAt: 'a', updatedAt: 'b' },
  matchedNoteSnippet: null,
});
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
type HookResult = ReturnType<typeof useBookSearch>;
type HookProps = { query: string };

afterEach(() => { jest.useRealTimers(); });

test('debounces searches and submits only the latest filters', async () => {
  jest.useFakeTimers();
  const repository = { search: jest.fn().mockResolvedValue([result('latest')]) };
  const { rerender } = await renderHook<HookResult, HookProps>(({ query }) => useBookSearch(repository, filters(query)), { initialProps: { query: '长' } });
  await rerender({ query: '长夜' });
  expect(repository.search).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(250); await Promise.resolve(); });
  expect(repository.search).toHaveBeenCalledTimes(1);
  expect(repository.search).toHaveBeenCalledWith(filters('长夜'));
});

test('does not let an older slow request replace newer results', async () => {
  jest.useFakeTimers();
  const first = deferred<BookSearchResult[]>();
  const second = deferred<BookSearchResult[]>();
  const repository = { search: jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) };
  const { result: hook, rerender } = await renderHook<HookResult, HookProps>(({ query }) => useBookSearch(repository, filters(query), { debounceMs: 0 }), { initialProps: { query: '旧' } });
  await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); });
  await rerender({ query: '新' });
  await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); });
  await act(async () => { second.resolve([result('new')]); await Promise.resolve(); });
  expect(hook.current.results[0].book.id).toBe('new');
  await act(async () => { first.resolve([result('old')]); await Promise.resolve(); });
  expect(hook.current.results[0].book.id).toBe('new');
});

test('keeps previous results on failure and retries current filters', async () => {
  jest.useFakeTimers();
  const repository = { search: jest.fn().mockResolvedValueOnce([result('first')]).mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce([result('recovered')]) };
  const { result: hook, rerender } = await renderHook<HookResult, HookProps>(({ query }) => useBookSearch(repository, filters(query), { debounceMs: 0 }), { initialProps: { query: '第一次' } });
  await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); });
  await waitFor(() => expect(hook.current.results[0].book.id).toBe('first'));
  await rerender({ query: '第二次' });
  await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); });
  await waitFor(() => expect(hook.current.error).toBe('搜索失败，请重试'));
  expect(hook.current.results[0].book.id).toBe('first');
  await act(async () => { hook.current.retry(); jest.runOnlyPendingTimers(); await Promise.resolve(); });
  await waitFor(() => expect(hook.current.results[0].book.id).toBe('recovered'));
});
