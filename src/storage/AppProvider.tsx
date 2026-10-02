import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SqliteBookRepository } from '../books/sqliteRepository';
import { SqliteReadingHistoryRepository } from '../books/readingHistoryRepository';
import { SqliteTagRepository } from '../books/tagRepository';
import { SqliteNotesRepository } from '../books/notesRepository';
import { openDatabase } from './database';

const RepositoryContext = createContext<SqliteBookRepository | null>(null);
const TagRepositoryContext = createContext<SqliteTagRepository | null>(null);
const ReadingHistoryContext = createContext<SqliteReadingHistoryRepository | null>(null);
const NotesRepositoryContext = createContext<SqliteNotesRepository | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [repository, setRepository] = useState<SqliteBookRepository | null>(null);
  const [tagRepository, setTagRepository] = useState<SqliteTagRepository | null>(null);
  const [readingHistory, setReadingHistory] = useState<SqliteReadingHistoryRepository | null>(null);
  const [notesRepository, setNotesRepository] = useState<SqliteNotesRepository | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    openDatabase().then(db => {
      if (active) {
        setRepository(new SqliteBookRepository(db));
        setTagRepository(new SqliteTagRepository(db));
        setReadingHistory(new SqliteReadingHistoryRepository(db));
        setNotesRepository(new SqliteNotesRepository(db));
      }
    }).catch(e => {
      if (active) setError(String(e));
    });
    return () => { active = false; };
  }, []);

  if (error) return <View style={{ padding: 24 }}><Text>无法打开书架：{error}</Text></View>;
  if (!repository || !tagRepository || !readingHistory || !notesRepository) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <RepositoryContext.Provider value={repository}><TagRepositoryContext.Provider value={tagRepository}><ReadingHistoryContext.Provider value={readingHistory}><NotesRepositoryContext.Provider value={notesRepository}>{children}</NotesRepositoryContext.Provider></ReadingHistoryContext.Provider></TagRepositoryContext.Provider></RepositoryContext.Provider>;
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

export function useReadingHistory(): SqliteReadingHistoryRepository {
  const repository = useContext(ReadingHistoryContext);
  if (!repository) throw new Error('Reading history repository is not ready');
  return repository;
}

export function useNotes(): SqliteNotesRepository {
  const repository = useContext(NotesRepositoryContext);
  if (!repository) throw new Error('Notes repository is not ready');
  return repository;
}
