import Storage from 'expo-sqlite/kv-store';

export const MAX_SUGGESTIONS = 8;
export type SuggestionKind = 'author' | 'platform';
type StorageLike = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };

const keyFor = (kind: SuggestionKind) => `novel-tracker.suggestions.${kind}.v1`;
const normalize = (values: string[]) => [...new Set(values.map(value => value.trim()).filter(Boolean))].slice(0, MAX_SUGGESTIONS);

export function createSuggestionHistory(storage: StorageLike) {
  async function list(kind: SuggestionKind, seed: string[] = []): Promise<string[]> {
    const key = keyFor(kind);
    const raw = await storage.getItem(key);
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(value => typeof value === 'string')) return normalize(parsed);
      } catch { /* Rebuild a malformed history from available book data. */ }
    }
    const initial = normalize(seed);
    await storage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return {
    list,
    async remember(kind: SuggestionKind, value: string): Promise<void> {
      const trimmed = value.trim();
      if (!trimmed) return;
      const current = await list(kind);
      await storage.setItem(keyFor(kind), JSON.stringify(normalize([trimmed, ...current.filter(item => item !== trimmed)])));
    },
    async remove(kind: SuggestionKind, value: string): Promise<void> {
      const current = await list(kind);
      await storage.setItem(keyFor(kind), JSON.stringify(current.filter(item => item !== value)));
    },
  };
}

export const suggestionHistory = createSuggestionHistory(Storage);
