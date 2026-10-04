import Storage from 'expo-sqlite/kv-store';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getThemePalette, THEME_STORAGE_KEY, type ThemeId, type ThemePalette } from './theme';

export type ThemeStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
const defaultStorage: ThemeStorage = { getItem: key => Storage.getItem(key), setItem: (key, value) => Storage.setItem(key, value) };

type ThemeContextValue = {
  theme: ThemePalette;
  themeId: ThemeId;
  setTheme(id: ThemeId): Promise<void>;
  saveError: string | null;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
const FALLBACK_THEME: ThemeContextValue = {
  theme: getThemePalette('forest'), themeId: 'forest', saveError: null,
  setTheme: async () => undefined,
};

export function ThemeProvider({ children, storage = defaultStorage }: { children: React.ReactNode; storage?: ThemeStorage }) {
  const [themeId, setThemeId] = useState<ThemeId>('forest');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void storage.getItem(THEME_STORAGE_KEY).then(value => {
      if (active) setThemeId(getThemePalette(value).id);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [storage]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: getThemePalette(themeId),
    themeId,
    saveError,
    setTheme: async (id: ThemeId) => {
      const previous = themeId;
      setSaveError(null);
      setThemeId(id);
      try {
        await storage.setItem(THEME_STORAGE_KEY, id);
      } catch {
        setThemeId(previous);
        setSaveError('主题保存失败，请重试');
      }
    },
  }), [saveError, storage, themeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  return value ?? FALLBACK_THEME;
}
