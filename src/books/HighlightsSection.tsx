import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { pickImages } from './imagePicker';
import { ImageStorage } from './imageStorage';
import type { ImageAsset } from './types';
import type { SqliteNotesRepository } from './notesRepository';
import { useTheme } from '../theme/ThemeProvider';
import { UI_LAYOUT } from '../ui/layout';

export function HighlightsSection({ bookId, repository, onChanged, onSelect }: {
  bookId: string; repository: SqliteNotesRepository; onChanged?: () => void; onSelect?: (images: ImageAsset[]) => void;
}) {
  const { theme } = useTheme();
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [error, setError] = useState('');
  const storage = new ImageStorage();
  async function refresh() { setImages(await repository.listHighlights(bookId)); }
  useEffect(() => {
    let active = true;
    void repository.listHighlights(bookId).then(next => { if (active) setImages(next); });
    return () => { active = false; };
  }, [bookId, repository]);
  async function add() {
    setError('');
    try {
      const uris = await pickImages();
      if (!uris.length) return;
      const assets = await Promise.all(uris.map(uri => storage.copyFromPicker(uri, bookId)));
      for (const asset of assets) await repository.registerImage(asset);
      await repository.addHighlights(bookId, assets.map(asset => asset.id));
      await refresh(); onChanged?.();
    } catch { setError('添加图片失败，请重试'); }
  }
  function remove(image: ImageAsset) {
    Alert.alert('删除精彩片段？', '如果摘记仍在使用图片，摘记中的图片不会被删除。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => { await repository.removeHighlight(bookId, image.id); await refresh(); onChanged?.(); } },
    ]);
  }
  return <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
    <View style={styles.heading}><Text style={[styles.label, { color: theme.text }]}>精彩片段</Text>
    <Pressable accessibilityRole="button" onPress={add}><Text style={[styles.add, { color: theme.primary }]}>添加图片</Text></Pressable></View>
    {images.length ? <View style={styles.grid}>{images.map(image => <Pressable key={image.id} accessibilityRole="button" accessibilityLabel="打开精彩片段图片" onPress={() => onSelect?.([image])} onLongPress={() => remove(image)}>
      <Image source={{ uri: image.localPath }} style={styles.image} />
    </Pressable>)}</View> : <Text style={[styles.empty, { color: theme.mutedText }]}>还没有精彩片段</Text>}
    {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { borderWidth: StyleSheet.hairlineWidth, padding: UI_LAYOUT.pageInset, borderRadius: UI_LAYOUT.groupRadius, gap: 10 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, label: { fontSize: 16, fontWeight: '700' }, add: { fontWeight: '700', paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, image: { width: 88, height: 88, borderRadius: 8 }, empty: {}, error: {},
});
