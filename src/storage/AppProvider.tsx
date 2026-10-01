import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SqliteBookRepository } from '../books/sqliteRepository';
import { SqliteTagRepository } from '../books/tagRepository';
import { openDatabase } from './database';

const RepositoryContext = createContext<SqliteBookRepository | null>(null);
const TagRepositoryContext = createContext<SqliteTagRepository | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [repository, setRepository] = useState<SqliteBookRepository | null>(null);
  const [tagRepository, setTagRepository] = useState<SqliteTagRepository | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    openDatabase().then(db => {
      if (active) {
        setRepository(new SqliteBookRepository(db));
        setTagRepository(new SqliteTagRepository(db));
      }
    }).catch(e => {
      if (active) setError(String(e));
    });
    return () => { active = false; };
  }, []);

  if (error) return <View style={{ padding: 24 }}><Text>无法打开书架：{error}</Text></View>;
  if (!repository || !tagRepository) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <RepositoryContext.Provider value={repository}><TagRepositoryContext.Provider value={tagRepository}>{children}</TagRepositoryContext.Provider></RepositoryContext.Provider>;
}

export function useBooks(): SqliteBookRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('Book repository is not ready');
  return repository;
}

export function useTags(): SqliteTagRepository {
  const repository = useContext(TagRepositoryContext);
  if (!repository) throw new Error('Tag repository is not ready');
  return repository;
}
