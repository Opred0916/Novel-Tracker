import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
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
import { BookCoverFiles } from '../books/bookCoverFiles';
import { ImageDeletionQueue } from '../books/imageDeletionQueue';
import { ImportCommitService } from '../import/importCommitService';
import { OpenExportArchive } from '../export/openExportArchive';
import { OpenExportService } from '../export/openExportService';
import { SqliteLibraryOverviewRepository } from '../books/libraryOverviewRepository';
import { SqliteAnnualRecapRepository } from '../books/annualRecapRepository';
import { SqliteImageOcrRepository, type ImageOcrProgress, type ImageOcrRecord } from '../books/imageOcrRepository';
import { ImageOcrWorker } from '../books/imageOcrWorker';
import { getLocalImageTextRecognizer } from '../books/localImageTextRecognizer';

const RepositoryContext = createContext<SqliteBookRepository | null>(null);
const TagRepositoryContext = createContext<SqliteTagRepository | null>(null);
const ReadingHistoryContext = createContext<SqliteReadingHistoryRepository | null>(null);
const NotesRepositoryContext = createContext<SqliteNotesRepository | null>(null);
const BookSearchRepositoryContext = createContext<SqliteBookSearchRepository | null>(null);
const BackupServiceContext = createContext<BackupService | null>(null);
const ImportCommitServiceContext = createContext<ImportCommitService | null>(null);
const OpenExportServiceContext = createContext<OpenExportService | null>(null);
const LibraryOverviewRepositoryContext = createContext<SqliteLibraryOverviewRepository | null>(null);
const AnnualRecapRepositoryContext = createContext<SqliteAnnualRecapRepository | null>(null);
type ImageOcrContextValue = {
  isAvailable: boolean;
  schedule(): Promise<void>;
  pause(): Promise<void>;
  resume(): void;
  retry(imageId: string): Promise<void>;
  get(imageId: string): Promise<ImageOcrRecord | null>;
  progress(bookId?: string): Promise<ImageOcrProgress>;
};
const ImageOcrContext = createContext<ImageOcrContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [repository, setRepository] = useState<SqliteBookRepository | null>(null);
  const [tagRepository, setTagRepository] = useState<SqliteTagRepository | null>(null);
  const [readingHistory, setReadingHistory] = useState<SqliteReadingHistoryRepository | null>(null);
  const [notesRepository, setNotesRepository] = useState<SqliteNotesRepository | null>(null);
  const [bookSearchRepository, setBookSearchRepository] = useState<SqliteBookSearchRepository | null>(null);
  const [backupService, setBackupService] = useState<BackupService | null>(null);
  const [importCommitService, setImportCommitService] = useState<ImportCommitService | null>(null);
  const [openExportService, setOpenExportService] = useState<OpenExportService | null>(null);
  const [libraryOverviewRepository, setLibraryOverviewRepository] = useState<SqliteLibraryOverviewRepository | null>(null);
  const [annualRecapRepository, setAnnualRecapRepository] = useState<SqliteAnnualRecapRepository | null>(null);
  const [imageOcrRepository, setImageOcrRepository] = useState<SqliteImageOcrRepository | null>(null);
  const [imageOcrWorker, setImageOcrWorker] = useState<ImageOcrWorker | null>(null);
  const [imageOcrAvailable, setImageOcrAvailable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    openDatabase().then(db => {
      if (active) {
        const deletionQueue = new ImageDeletionQueue(db);
        const books = new SqliteBookRepository(db, undefined, undefined, new BookCoverFiles(), deletionQueue);
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
        setOpenExportService(new OpenExportService(
          new SqliteBackupRepository(db),
          new OpenExportArchive(new ExpoBackupFilePort()),
          new BackupFileStorage(),
          Constants.expoConfig?.version ?? '1.0.0',
          randomUUID,
        ));
        setLibraryOverviewRepository(new SqliteLibraryOverviewRepository(db));
        setAnnualRecapRepository(new SqliteAnnualRecapRepository(db));
        const imageOcr = new SqliteImageOcrRepository(db);
        const recognizer = getLocalImageTextRecognizer();
        const imageOcrWorker = new ImageOcrWorker(imageOcr, recognizer);
        setImageOcrRepository(imageOcr);
        setImageOcrWorker(imageOcrWorker);
        setImageOcrAvailable(recognizer.isAvailable());
        setImportCommitService(new ImportCommitService(db));
        void deletionQueue.drain().catch(() => undefined);
        void backup.cleanupStaleOperations().catch(() => undefined);
      }
    }).catch(e => {
      if (active) setError(String(e));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!imageOcrRepository || !imageOcrWorker) return undefined;
    let active = true;
    void imageOcrRepository.reconcile(true).catch(() => undefined).finally(() => {
      if (active && AppState.currentState === 'active') imageOcrWorker.resume();
    });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') imageOcrWorker.resume();
      else imageOcrWorker.pause();
    });
    return () => { active = false; imageOcrWorker.pause(); subscription.remove(); };
  }, [imageOcrRepository, imageOcrWorker]);

  if (error) return <View style={{ padding: 24 }}><Text>无法打开书架：{error}</Text></View>;
  if (!repository || !tagRepository || !readingHistory || !notesRepository || !bookSearchRepository || !backupService || !importCommitService || !openExportService || !libraryOverviewRepository || !annualRecapRepository || !imageOcrRepository || !imageOcrWorker) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  const imageOcrContext: ImageOcrContextValue = {
    isAvailable: imageOcrAvailable,
    schedule: async () => { await imageOcrRepository.reconcile(false); imageOcrWorker.kick(); },
    pause: async () => { imageOcrWorker.invalidateAndPause(); },
    resume: () => imageOcrWorker.resume(),
    retry: imageId => imageOcrWorker.retry(imageId),
    get: imageId => imageOcrRepository.get(imageId),
    progress: bookId => imageOcrRepository.progress(bookId),
  };
  return <RepositoryContext.Provider value={repository}><TagRepositoryContext.Provider value={tagRepository}><ReadingHistoryContext.Provider value={readingHistory}><NotesRepositoryContext.Provider value={notesRepository}><BookSearchRepositoryContext.Provider value={bookSearchRepository}><BackupServiceContext.Provider value={backupService}><OpenExportServiceContext.Provider value={openExportService}><ImportCommitServiceContext.Provider value={importCommitService}><LibraryOverviewRepositoryContext.Provider value={libraryOverviewRepository}><AnnualRecapRepositoryContext.Provider value={annualRecapRepository}><ImageOcrContext.Provider value={imageOcrContext}>{children}</ImageOcrContext.Provider></AnnualRecapRepositoryContext.Provider></LibraryOverviewRepositoryContext.Provider></ImportCommitServiceContext.Provider></OpenExportServiceContext.Provider></BackupServiceContext.Provider></BookSearchRepositoryContext.Provider></NotesRepositoryContext.Provider></ReadingHistoryContext.Provider></TagRepositoryContext.Provider></RepositoryContext.Provider>;
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

export function useImportCommitService(): ImportCommitService {
  const service = useContext(ImportCommitServiceContext);
  if (!service) throw new Error('Import service is not ready');
  return service;
}

export function useOpenExportService(): OpenExportService {
  const service = useContext(OpenExportServiceContext);
  if (!service) throw new Error('Open export service is not ready');
  return service;
}

export function useLibraryOverviewRepository(): SqliteLibraryOverviewRepository {
  const repository = useContext(LibraryOverviewRepositoryContext);
  if (!repository) throw new Error('Library overview repository is not ready');
  return repository;
}

export function useAnnualRecapRepository(): SqliteAnnualRecapRepository {
  const repository = useContext(AnnualRecapRepositoryContext);
  if (!repository) throw new Error('Annual recap repository is not ready');
  return repository;
}

export function useImageOcr(): ImageOcrContextValue {
  const value = useContext(ImageOcrContext);
  if (!value) throw new Error('Image OCR is not ready');
  return value;
}
