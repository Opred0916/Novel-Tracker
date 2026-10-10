import React, { useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ImageStorage } from './imageStorage';
import { pickImages } from './imagePicker';
import type { ImageAsset, Note, NoteInput } from './types';
import type { SqliteNotesRepository } from './notesRepository';
import { useTheme } from '../theme/ThemeProvider';
import { UI_LAYOUT } from '../ui/layout';
import { useLibraryImageDirectory } from '../account/LibraryNamespace';

export type NoteFormRepository = Pick<SqliteNotesRepository, 'createNote' | 'updateNote' | 'registerImage' | 'addHighlights'>;

export function NoteForm({ bookId, note, highlights, repository, onSaved, onCancel, embedded = false, autoFocus = false, onDirtyChange }: {
  bookId: string; note?: Note; highlights: ImageAsset[]; repository: NoteFormRepository; onSaved: () => void; onCancel: () => void;
  embedded?: boolean; autoFocus?: boolean; onDirtyChange?: (dirty: boolean) => void;
}) {
  const { theme } = useTheme();
  const imageDirectory = useLibraryImageDirectory();
  const [body, setBody] = useState(note?.body ?? '');
  const [images, setImages] = useState<ImageAsset[]>(note?.images ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  function reportDirty(nextBody: string, nextImages: ImageAsset[]) {
    onDirtyChange?.(nextBody !== (note?.body ?? '') || nextImages.map(image => image.id).join('|') !== (note?.images ?? []).map(image => image.id).join('|'));
  }
  function changeBody(value: string) { setBody(value); reportDirty(value, images); }
  function changeImages(nextImages: ImageAsset[]) { setImages(nextImages); reportDirty(body, nextImages); }
  async function addAlbumImages() {
    try {
      const uris = await pickImages();
      if (!uris.length) return;
      const sync = await new Promise<boolean>(resolve => Alert.alert('加入精彩片段？', '是否同时加入“精彩片段”？', [
        { text: '否', onPress: () => resolve(false) }, { text: '是', onPress: () => resolve(true) },
      ]));
      const assets = await Promise.all(uris.map(uri => new ImageStorage(undefined, imageDirectory).copyFromPicker(uri, bookId)));
      for (const asset of assets) await repository.registerImage(asset);
      if (sync) await repository.addHighlights(bookId, assets.map(asset => asset.id));
      changeImages([...images, ...assets]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '添加图片失败，请重试'); }
  }
  function addHighlightImages() { changeImages([...images, ...highlights.filter(image => !images.some(item => item.id === image.id))]); }
  async function save() {
    if (savingRef.current) return;
    setError('');
    if (!body.trim()) { setError('请输入我的想法'); return; }
    const input: NoteInput = { body, imageIds: images.map(image => image.id) };
    savingRef.current = true; setSaving(true);
    try { if (note) await repository.updateNote(bookId, note.id, input); else await repository.createNote(bookId, input); onDirtyChange?.(false); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  const fields = <>
    {!embedded ? <Text style={[styles.title, { color: theme.text }]}>{note ? '编辑摘记' : '新增摘记'}</Text> : null}
    <Text style={[styles.label, { color: theme.text }]}>我的想法 *</Text>
    <TextInput multiline autoFocus={autoFocus} value={body} onChangeText={changeBody} placeholder="写下这次阅读的想法" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} textAlignVertical="top" />
    <View style={styles.actions}><Pressable accessibilityRole="button" onPress={addHighlightImages} style={[styles.secondary, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text }}>从精彩片段选择</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void addAlbumImages()} style={[styles.secondary, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text }}>从相册添加</Text></Pressable></View>
    {images.length ? <View style={styles.grid}>{images.map(image => <Image key={image.id} source={{ uri: image.localPath }} style={styles.image} />)}</View> : <Text style={[styles.hint, { color: theme.mutedText }]}>图片可选</Text>}
    {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}><Text style={styles.saveText}>保存摘记</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={styles.cancel}><Text style={{ color: theme.primary }}>取消</Text></Pressable>
  </>;
  return embedded ? <View style={styles.embedded}>{fields}</View> : <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>{fields}</ScrollView>;
}

const styles = StyleSheet.create({ container: { padding: UI_LAYOUT.pageInset, gap: 12, paddingBottom: 100 }, embedded: { gap: 12, paddingBottom: 12 }, title: { fontSize: 24, fontWeight: '700' }, label: { fontWeight: '700' }, input: { minHeight: 160, borderWidth: 1, borderRadius: UI_LAYOUT.groupRadius, padding: 14, fontSize: 17 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, secondary: { borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 44, justifyContent: 'center' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, image: { width: 86, height: 86, borderRadius: 8 }, hint: {}, error: {}, save: { borderRadius: UI_LAYOUT.groupRadius, padding: 16, alignItems: 'center' }, saveText: { color: '#fff', fontWeight: '700' }, cancel: { alignItems: 'center', padding: 12 }, });
