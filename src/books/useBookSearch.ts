import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BookSearchFilters, BookSearchResult } from './bookSearch';

type SearchRepository = { search(filters: BookSearchFilters): Promise<BookSearchResult[]> };

export function useBookSearch(repository: SearchRepository, filters: BookSearchFilters, options: { debounceMs?: number } = {}) {
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const requestId = useRef(0);
  const tagIdsKey = JSON.stringify(filters.tagIds);
  const stableFilters = useMemo<BookSearchFilters>(() => ({
    query: filters.query,
    status: filters.status,
    bookType: filters.bookType,
    tagIds: JSON.parse(tagIdsKey) as string[],
  }), [filters.query, filters.status, filters.bookType, tagIdsKey]);
  const debounceMs = options.debounceMs ?? 250;

  useEffect(() => {
    let active = true;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      repository.search(stableFilters).then(next => {
        if (active && currentRequest === requestId.current) setResults(next);
      }).catch(() => {
        if (active && currentRequest === requestId.current) setError('搜索失败，请重试');
      }).finally(() => {
        if (active && currentRequest === requestId.current) setLoading(false);
      });
    }, debounceMs);
    return () => { active = false; clearTimeout(timer); };
  }, [repository, stableFilters, debounceMs, retryToken]);

  const retry = useCallback(() => setRetryToken(value => value + 1), []);
  return { results, loading, error, retry };
}
