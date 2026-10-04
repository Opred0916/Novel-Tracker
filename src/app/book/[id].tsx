import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookDetail } from '../../books/BookDetail';
import type { Book, ImageAsset, ReadingSession } from '../../books/types';
import { useBooks, useImageOcr, useNotes, useReadingHistory } from '../../storage/AppProvider';
import { NotesSection } from '../../books/NotesSection';
import { HighlightsSection } from '../../books/HighlightsSection';
import { ImagePreview } from '../../books/ImagePreview';
import type { ImageOcrProgress, ImageOcrRecord } from '../../books/imageOcrRepository';

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

export default function BookPage() {
  const { id, focusImageId, focusNoteId } = useLocalSearchParams<{ id: string; focusImageId?: string; focusNoteId?: string }>();
  const repo = useBooks();
  const historyRepo = useReadingHistory();
  const notesRepo = useNotes();
  const imageOcr = useImageOcr();
  const [book, setBook] = useState<Book | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [highlights, setHighlights] = useState<ImageAsset[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [retry, setRetry] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [previewImage, setPreviewImage] = useState<ImageAsset | null>(null);
  const [previewOcr, setPreviewOcr] = useState<ImageOcrRecord | null>(null);
  const [ocrProgress, setOcrProgress] = useState<ImageOcrProgress | null>(null);
  const [notesSectionY, setNotesSectionY] = useState(0);
  const [notesSectionLaidOut, setNotesSectionLaidOut] = useState(false);
  const [focusNotePosition, setFocusNotePosition] = useState<{ noteId: string; y: number } | null>(null);
  const [focusNoteError, setFocusNoteError] = useState('');
  const detailScrollRef = useRef<ScrollView>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoadState('loading');
    if (typeof id !== 'string' || !id) {
      setLoadState('missing');
      return () => { active = false; };
    }
    Promise.all([repo.get(id), historyRepo.list(id), notesRepo.listHighlights(id)]).then(([result, records, images]) => {
      if (!active) return;
      setBook(result);
      setSessions(records);
      setHighlights(images);
      setLoadState(result ? 'ready' : 'missing');
    }).catch(() => { if (active) setLoadState('error'); });
    return () => { active = false; };
  // `retry` intentionally invalidates this focus callback to trigger a fresh read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, repo, historyRepo, notesRepo, retry]));

  useEffect(() => {
    let active = true;
    if (!book || typeof id !== 'string' || typeof focusImageId !== 'string' || !focusImageId) return () => { active = false; };
    Promise.all([notesRepo.resolveLinkedImage(id, focusImageId), imageOcr.get(focusImageId)]).then(([resolved, ocr]) => {
      if (!active || !resolved) return;
      setPreviewImage(resolved.image);
      setPreviewOcr(ocr);
    }).catch(() => { if (active) { setPreviewImage(null); setPreviewOcr(null); } });
    return () => { active = false; };
  }, [book, focusImageId, id, imageOcr, notesRepo]);

  useEffect(() => {
    if (!book || typeof id !== 'string') return;
    void Promise.resolve(imageOcr.progress(id)).then(setOcrProgress).catch(() => setOcrProgress(null));
  }, [book, id, imageOcr, retry]);

  const handleNoteFocus = useCallback((found: boolean, contentY?: number) => {
    if (!focusNoteId) return;
    if (!found) {
      setFocusNoteError('这条想法已不存在');
      return;
    }
    setFocusNoteError('');
    if (contentY !== undefined) setFocusNotePosition({ noteId: focusNoteId, y: contentY });
  }, [focusNoteId]);

  useEffect(() => {
    if (!focusNoteId || !notesSectionLaidOut || focusNotePosition?.noteId !== focusNoteId) return;
    detailScrollRef.current?.scrollTo({ y: Math.max(0, notesSectionY + focusNotePosition.y - 24), animated: true });
  }, [focusNoteId, focusNotePosition, notesSectionLaidOut, notesSectionY]);

  if (loadState === 'loading') return <View style={styles.center}><ActivityIndicator /></View>;
  if (loadState === 'missing') return <View style={styles.center}>
    <Text style={styles.message}>找不到这本小说</Text>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={styles.link}>返回书架</Text></Pressable>
  </View>;
  if (loadState === 'error') return <View style={styles.center}>
    <Text style={styles.message}>读取小说失败，请重试</Text>
    <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={styles.link}>重试</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={styles.link}>返回书架</Text></Pressable>
  </View>;
  if (!book) return null;
  const currentBook = book;

  async function showImage(image: ImageAsset) {
    setPreviewImage(image);
    setPreviewOcr(await imageOcr.get(image.id));
  }

  function handleImagesChanged() {
    setRetry(value => value + 1);
    void imageOcr.schedule();
  }

  async function deleteBook() {
    setDeleting(true);
    setDeleteError('');
    try {
      await repo.delete(id);
      router.replace('/');
    } catch {
      setDeleting(false);
      setDeleteError('删除失败，请重试');
    }
  }

  function confirmDelete() {
    if (deleting) return;
    Alert.alert('删除小说', `确定要删除《${currentBook.title}》以及它的阅读记录、摘记、精彩片段和封面吗？删除后无法在应用内撤销。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除小说', style: 'destructive', onPress: () => { void deleteBook(); } },
    ]);
  }

  return <ScrollView ref={detailScrollRef} testID="book-detail-scroll" style={styles.page} contentContainerStyle={styles.content}>
    <BookDetail book={currentBook} sessions={sessions} onEditReading={sessionId => router.push({
      pathname: '/book/[id]/reading/[sessionId]', params: { id, sessionId },
    })} />
    <View testID="notes-section-container" onLayout={event => { setNotesSectionY(event.nativeEvent.layout.y); setNotesSectionLaidOut(true); }}>
      <NotesSection bookId={id} repository={notesRepo} highlights={highlights} sessions={sessions} focusNoteId={focusNoteId} onFocusResult={handleNoteFocus} onSelect={images => { if (images[0]) void showImage(images[0]); }} onChanged={handleImagesChanged} />
    </View>
    {focusNoteError ? <Text style={styles.focusNoteError}>{focusNoteError}</Text> : null}
    <HighlightsSection bookId={id} repository={notesRepo} onSelect={images => { if (images[0]) void showImage(images[0]); }} onChanged={handleImagesChanged} />
    {ocrProgress && ocrProgress.total > 0 ? <Text style={styles.ocrProgress}>图片文字识别：{ocrProgress.done}/{ocrProgress.total}{ocrProgress.failed ? `（失败 ${ocrProgress.failed}）` : ''}</Text> : null}
    <Pressable accessibilityRole="button" disabled={deleting} style={[styles.edit, deleting && styles.disabled]} onPress={() => router.push({ pathname: '/book/[id]/edit', params: { id } })}>
      <Text style={styles.editText}>编辑资料</Text>
    </Pressable>
    {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
    <Pressable accessibilityRole="button" disabled={deleting} style={[styles.delete, deleting && styles.disabled]} onPress={confirmDelete}>
      <Text style={styles.deleteText}>{deleting ? '正在删除…' : '删除小说'}</Text>
    </Pressable>
    <ImagePreview image={previewImage} visible={Boolean(previewImage)} status={previewOcr ? previewOcr.status : imageOcr.isAvailable ? 'pending' : 'unavailable'} recognizedText={previewOcr?.recognizedText} onClose={() => { setPreviewImage(null); setPreviewOcr(null); }} onRetry={previewImage ? async () => { await imageOcr.retry(previewImage.id); setPreviewOcr(await imageOcr.get(previewImage.id)); } : undefined} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 24 },
  message: { fontSize: 17, color: '#302a25' },
  link: { fontSize: 16, color: '#593f72', fontWeight: '600' },
  edit: { backgroundColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center', marginHorizontal: 24, marginTop: 8 },
  editText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  delete: { borderWidth: 1, borderColor: '#b52626', padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 24, marginTop: 12 },
  deleteText: { color: '#b52626', fontWeight: '700', fontSize: 16 },
  deleteError: { color: '#b52626', textAlign: 'center', marginHorizontal: 24, marginTop: 14 },
  ocrProgress: { color: '#766f68', fontSize: 13, textAlign: 'center', marginTop: 14 },
  focusNoteError: { color: '#b52626', textAlign: 'center', marginHorizontal: 24, marginTop: 12 },
  disabled: { opacity: 0.55 },
});
