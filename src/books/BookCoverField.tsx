import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookCover } from './BookCover';
import { BookCoverFiles, type StagedCover } from './bookCoverFiles';
import { pickImages } from './imagePicker';
import { useTheme } from '../theme/ThemeProvider';

const defaultFiles = new BookCoverFiles();

export function BookCoverField({ title, initialUri, files = defaultFiles, onChange }: {
  title: string;
  initialUri?: string | null;
  files?: BookCoverFiles;
  onChange: (value: StagedCover | null, removed: boolean) => void;
}) {
  const { theme } = useTheme();
  const [staged, setStaged] = useState<StagedCover | null>(null);
  const [removed, setRemoved] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const stagedRef = useRef<StagedCover | null>(null);
  const previewUri = staged?.uri ?? (removed ? null : initialUri);

  useEffect(() => () => {
    mounted.current = false;
    if (stagedRef.current) void files.discard(stagedRef.current).catch(() => undefined);
  }, [files]);

  async function applyStage(next: StagedCover) {
    if (staged && staged.uri !== next.uri) await files.discard(staged).catch(() => undefined);
    stagedRef.current = next;
    setStaged(next); setRemoved(false); onChange(next, false);
  }

  async function choosePhoto() {
    setBusy(true); setError('');
    try {
      const [uri] = await pickImages();
      if (!uri) return;
      const next = await files.stageFromPicker(uri);
      if (!mounted.current) { await files.discard(next).catch(() => undefined); return; }
      await applyStage(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '读取图片失败'); }
    finally { setBusy(false); }
  }

  async function useUrl() {
    setBusy(true); setError('');
    try {
      const next = await files.stageFromUrl(url);
      if (!mounted.current) { await files.discard(next).catch(() => undefined); return; }
      await applyStage(next); setUrl('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '下载图片失败'); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (staged) await files.discard(staged).catch(() => undefined);
    stagedRef.current = null;
    setStaged(null); setRemoved(true); onChange(null, true);
  }

  return <View style={styles.container}>
    <Text style={[styles.label, { color: theme.text }]}>封面（可选）</Text>
    <View style={styles.previewRow}><BookCover title={title || '小说'} uri={previewUri} size="small" />
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={choosePhoto} style={[styles.action, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={[styles.actionText, { color: theme.primary }]}>从相册选择</Text></Pressable>
        {(previewUri || staged) ? <Pressable accessibilityRole="button" disabled={busy} onPress={remove} style={[styles.action, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={[styles.removeText, { color: theme.danger }]}>移除封面</Text></Pressable> : null}
      </View>
    </View>
    <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="粘贴 HTTPS 图片链接" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
    <Pressable accessibilityRole="button" disabled={busy || !url.trim()} onPress={useUrl} style={[styles.urlButton, { backgroundColor: theme.primary }, (!url.trim() || busy) && styles.disabled]}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.urlText}>使用链接</Text>}
    </Pressable>
    {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <Text style={[styles.help, { color: theme.mutedText }]}>图片会保存在本机；网络链接仅用于下载，不会保存链接。</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 9, marginTop: 8 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25' },
  previewRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  actions: { gap: 8 },
  action: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' },
  actionText: { color: '#28584E', fontWeight: '600' },
  removeText: { color: '#a33b26', fontWeight: '600' },
  input: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 10, padding: 12, backgroundColor: '#fff' },
  urlButton: { backgroundColor: '#28584E', padding: 11, borderRadius: 10, alignItems: 'center' },
  disabled: { opacity: 0.45 },
  urlText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b52626' },
  help: { color: '#766f68', fontSize: 12 },
});
