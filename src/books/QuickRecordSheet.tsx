import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { useTheme } from '../theme/ThemeProvider';
import type { BookRepository } from './repository';
import type { SqliteReadingHistoryRepository } from './readingHistoryRepository';
import type { SqliteNotesRepository } from './notesRepository';
import type { Book, ImageAsset, ReadingSession } from './types';
import { BookCover } from './BookCover';
import { NoteForm, type NoteFormRepository } from './NoteForm';
import { ReadingDateFields } from './ReadingDateFields';
import { RatingField } from './RatingField';
import { todayLocalDate } from './readingDates';

export type QuickRecordResult = 'note_saved' | 'finished' | 'dropped';
type Mode = 'menu' | 'note' | 'finished' | 'dropped';

export function QuickRecordSheet({ visible, bookId, books, history, notes, onClose, onChanged }: {
  visible: boolean;
  bookId: string | null;
  books: Pick<BookRepository, 'get' | 'endReading'>;
  history: Pick<SqliteReadingHistoryRepository, 'list'>;
  notes: NoteFormRepository & Pick<SqliteNotesRepository, 'listHighlights'>;
  onClose(): void;
  onChanged(result: QuickRecordResult): void;
}) {
  if (!visible || !bookId) return null;
  return <QuickRecordSheetContent key={bookId} bookId={bookId} books={books} history={history} notes={notes} onClose={onClose} onChanged={onChanged} />;
}

function QuickRecordSheetContent({ bookId, books, history, notes, onClose, onChanged }: {
  bookId: string;
  books: Pick<BookRepository, 'get' | 'endReading'>;
  history: Pick<SqliteReadingHistoryRepository, 'list'>;
  notes: NoteFormRepository & Pick<SqliteNotesRepository, 'listHighlights'>;
  onClose(): void;
  onChanged(result: QuickRecordResult): void;
}) {
  const { theme } = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  const [highlights, setHighlights] = useState<ImageAsset[]>([]);
  const [mode, setMode] = useState<Mode>('menu');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [startedOn, setStartedOn] = useState(todayLocalDate());
  const [endedOn, setEndedOn] = useState(todayLocalDate());
  const [ratingHalfStars, setRatingHalfStars] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const loadToken = useRef(0);

  const load = useCallback(async (id: string, token: number) => {
    try {
      const [nextBook, sessions, images] = await Promise.all([books.get(id), history.list(id), notes.listHighlights(id)]);
      if (loadToken.current !== token) return;
      setBook(nextBook);
      setHighlights(images);
      const active = (sessions as ReadingSession[]).find(session => session.outcome === 'reading');
      const today = todayLocalDate();
      setStartedOn(active?.startedOn ?? today);
      setEndedOn(today);
      setRatingHalfStars(nextBook?.ratingHalfStars ?? null);
    } catch {
      if (loadToken.current === token) setError('读取小说失败，请重试');
    } finally {
      if (loadToken.current === token) setLoading(false);
    }
  }, [books, history, notes]);

  useEffect(() => {
    const token = ++loadToken.current;
    void load(bookId, token);
    return () => { loadToken.current += 1; };
  }, [bookId, load]);

  function retryLoad() {
    setLoading(true); setError('');
    void load(bookId, ++loadToken.current);
  }

  function close() {
    if (savingRef.current) return;
    if ((mode === 'note' && noteDirty) || mode === 'finished' || mode === 'dropped') {
      Alert.alert('放弃未保存内容？', '本次填写的内容不会保存。', [
        { text: '继续编辑', style: 'cancel' },
        { text: '放弃', style: 'destructive', onPress: onClose },
      ]);
      return;
    }
    onClose();
  }

  async function endReading() {
    if (savingRef.current || (mode !== 'finished' && mode !== 'dropped')) return;
    savingRef.current = true; setSaving(true); setError('');
    const outcome = mode;
    try {
      if (outcome === 'finished') await books.endReading(bookId, { outcome, startedOn, endedOn, ratingHalfStars });
      else await books.endReading(bookId, { outcome, startedOn, endedOn });
      onChanged(outcome);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试');
    } finally {
      savingRef.current = false; setSaving(false);
    }
  }

  return <BottomSheet visible title="快捷记录" onClose={close}>
    {loading ? <ActivityIndicator accessibilityLabel="正在读取小说" color={theme.primary} /> : null}
    {error ? <View style={styles.errorRow}><Text style={{ color: theme.danger }}>{error}</Text>{!book ? <Pressable onPress={retryLoad}><Text style={{ color: theme.primary }}>重试</Text></Pressable> : null}</View> : null}
    {!loading && !error && (!book || book.status !== 'reading') ? <Text style={{ color: theme.mutedText }}>这本书的阅读状态已变化，请返回书架刷新。</Text> : null}
    {!loading && book?.status === 'reading' ? <>
      <View style={styles.bookRow}><BookCover title={book.title} bookId={book.id} uri={book.coverUri} size="small" /><View style={styles.bookInfo}><Text style={[styles.bookTitle, { color: theme.text }]}>{book.title}</Text>{book.author ? <Text style={{ color: theme.mutedText }}>{book.author}</Text> : null}</View></View>
      {mode === 'menu' ? <View style={styles.actions}>
        {notice ? <Text style={{ color: theme.primary }}>{notice}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => { setMode('note'); setNotice(''); }} style={[styles.action, { borderColor: theme.border }]}><Text style={{ color: theme.primary }}>写想法</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setMode('finished'); setNotice(''); }} style={[styles.action, { borderColor: theme.border }]}><Text style={{ color: theme.primary }}>标记读完</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setMode('dropped'); setNotice(''); }} style={[styles.action, { borderColor: theme.border }]}><Text style={{ color: theme.primary }}>标记弃读</Text></Pressable>
      </View> : null}
      {mode === 'note' ? <NoteForm bookId={bookId} highlights={highlights} repository={notes} embedded autoFocus onDirtyChange={setNoteDirty}
        onCancel={() => { if (noteDirty) close(); else setMode('menu'); }}
        onSaved={() => { setNoteDirty(false); setMode('menu'); setNotice('想法已保存'); onChanged('note_saved'); }} /> : null}
      {mode === 'finished' || mode === 'dropped' ? <View style={styles.actions}>
        <Text style={[styles.label, { color: theme.text }]}>{mode === 'finished' ? '标记读完' : '标记弃读'}</Text>
        <ReadingDateFields startedOn={startedOn} endedOn={endedOn} showEnd onStartChange={setStartedOn} onEndChange={setEndedOn} />
        {mode === 'finished' ? <RatingField value={ratingHalfStars} onChange={setRatingHalfStars} allowNewValue /> : null}
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void endReading()} style={[styles.primary, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}><Text style={styles.primaryText}>{mode === 'finished' ? '确认读完' : '确认弃读'}</Text></Pressable>
        <Pressable disabled={saving} onPress={() => { setMode('menu'); setError(''); }} style={styles.back}><Text style={{ color: theme.primary }}>返回</Text></Pressable>
      </View> : null}
    </> : null}
  </BottomSheet>;
}

const styles = StyleSheet.create({
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, bookInfo: { flex: 1, gap: 5 }, bookTitle: { fontSize: 18, fontWeight: '700' },
  actions: { gap: 12 }, action: { borderWidth: 1, borderRadius: 12, padding: 14 }, label: { fontWeight: '700' },
  primary: { padding: 15, borderRadius: 12, alignItems: 'center' }, primaryText: { color: 'white', fontWeight: '700' },
  back: { alignItems: 'center', padding: 10 }, errorRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
});
