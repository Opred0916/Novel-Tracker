import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SqliteBookRepository } from '../books/sqliteRepository';
import { SqliteReadingHistoryRepository } from '../books/readingHistoryRepository';
import { SqliteTagRepository } from '../books/tagRepository';
import { SqliteNotesRepository } from '../books/notesRepository';
import { SqliteBookSearchRepository } from '../books/bookSearchRepository';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import { BackupArchive } from '../backup/backupArchive';
import { ExpoBackupFilePort } from '../backup/backupFilePort';
import { BackupFileStorage } from '../backup/backupFileStorage';
import { SqliteBackupRepository } from '../backup/backupRepository';
import { BackupService } from '../backup/backupService';
import { openDatabase } from './database';

const RepositoryContext = createContext<SqliteBookRepository | null>(null);
const TagRepositoryContext = createContext<SqliteTagRepository | null>(null);
const ReadingHistoryContext = createContext<SqliteReadingHistoryRepository | null>(null);
const NotesRepositoryContext = createContext<SqliteNotesRepository | null>(null);
const BookSearchRepositoryContext = createContext<SqliteBookSearchRepository | null>(null);
const BackupServiceContext = createContext<BackupService | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [repository, setRepository] = useState<SqliteBookRepository | null>(null);
  const [tagRepository, setTagRepository] = useState<SqliteTagRepository | null>(null);
  const [readingHistory, setReadingHistory] = useState<SqliteReadingHistoryRepository | null>(null);
  const [notesRepository, setNotesRepository] = useState<SqliteNotesRepository | null>(null);
  const [bookSearchRepository, setBookSearchRepository] = useState<SqliteBookSearchRepository | null>(null);
  const [backupService, setBackupService] = useState<BackupService | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    openDatabase().then(db => {
      if (active) {
        const books = new SqliteBookRepository(db);
        setRepository(books);
        setTagRepository(new SqliteTagRepository(db));
        const notes = new SqliteNotesRepository(db);
        setNotesRepository(notes);
        setReadingHistory(new SqliteReadingHistoryRepository(db, undefined, bookId => notes.recalculateAssociations(bookId)));
        setBookSearchRepository(new SqliteBookSearchRepository(db, books));
        const backup = new BackupService(
          new SqliteBackupRepository(db),
          new BackupArchive(new ExpoBackupFilePort()),
          new BackupFileStorage(),
          Constants.expoConfig?.version ?? '1.0.0',
          randomUUID,
        );
        setBackupService(backup);
        void backup.cleanupStaleOperations().catch(() => undefined);
      }
    }).catch(e => {
      if (active) setError(String(e));
    });
    return () => { active = false; };
  }, []);

  if (error) return <View style={{ padding: 24 }}><Text>无法打开书架：{error}</Text></View>;
  if (!repository || !tagRepository || !readingHistory || !notesRepository || !bookSearchRepository || !backupService) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <RepositoryContext.Provider value={repository}><TagRepositoryContext.Provider value={tagRepository}><ReadingHistoryContext.Provider value={readingHistory}><NotesRepositoryContext.Provider value={notesRepository}><BookSearchRepositoryContext.Provider value={bookSearchRepository}><BackupServiceContext.Provider value={backupService}>{children}</BackupServiceContext.Provider></BookSearchRepositoryContext.Provider></NotesRepositoryContext.Provider></ReadingHistoryContext.Provider></TagRepositoryContext.Provider></RepositoryContext.Provider>;
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

export function useBookSearchRepository(): SqliteBookSearchRepository {
  const repository = useContext(BookSearchRepositoryContext);
  if (!repository) throw new Error('Book search repository is not ready');
  return repository;
}

export function useBackupService(): BackupService {
  const service = useContext(BackupServiceContext);
  if (!service) throw new Error('Backup service is not ready');
  return service;
}
