import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RecapShareCard } from '../../books/RecapShareCard';
import { captureRecapPng, discardRecapPng, saveRecapPng, shareRecapPng } from '../../books/recapSharePlatform';
import { isRecapShareThemeId, makeRecapShareSnapshot, type RecapShareSnapshot } from '../../books/recapShareSnapshot';
import { useThemedRecapRepository } from '../../storage/AppProvider';
import { useTheme } from '../../theme/ThemeProvider';
import type { ThemePalette } from '../../theme/theme';
import { UI_LAYOUT } from '../../ui/layout';

function messageFor(error: unknown, action: 'save' | 'share'): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: string }).code;
    if (code === 'permission_denied') return '未获得相册写入权限，可以改用系统分享';
    if (code === 'unavailable') return '这台设备暂时无法使用系统分享';
  }
  return action === 'save' ? '保存失败，请重试' : '无法打开分享面板，请重试';
}

export default function RecapSharePage() {
  const params = useLocalSearchParams<{ year?: string | string[]; theme?: string | string[] }>();
  const year = typeof params.year === 'string' && /^\d{4}$/.test(params.year) ? Number(params.year) : NaN;
  const themeId = typeof params.theme === 'string' && isRecapShareThemeId(params.theme) ? params.theme : null;
  const valid = Number.isInteger(year) && year >= 1 && year <= 9999 && themeId !== null;
  const { theme } = useTheme();
  if (!valid || !themeId) return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: theme.background }]}><Text style={{ color: theme.danger }}>图片参数无效</Text><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={{ color: theme.primary }}>返回主题回顾</Text></Pressable></ScrollView>;
  return <RecapShareContent key={`${year}:${themeId}:${theme.id}`} year={year} themeId={themeId} theme={theme} />;
}

function RecapShareContent({ year, themeId, theme }: { year: number; themeId: 'rereadSuccess' | 'fiveStar' | 'dropped'; theme: ThemePalette }) {
  const repository = useThemedRecapRepository();
  const [snapshot, setSnapshot] = useState<RecapShareSnapshot | null | undefined>(undefined);
  const [loadError, setLoadError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const viewRef = useRef<View>(null);
  const busyRef = useRef(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    void repository.getYear(year).then(recap => {
      if (activeRef.current) setSnapshot(makeRecapShareSnapshot(recap, themeId, theme));
    }).catch(() => { if (activeRef.current) setLoadError('读取主题回顾失败，请返回重试'); });
    return () => { activeRef.current = false; };
  }, [repository, year, themeId, theme]);

  const onCardReady = useCallback((value: boolean) => setReady(value), []);

  async function run(action: 'save' | 'share') {
    if (busyRef.current || !ready || !snapshot || !viewRef.current) return;
    busyRef.current = true; setBusy(true); setMessage('');
    let uri: string | null = null;
    try {
      uri = await captureRecapPng(viewRef.current);
      if (!activeRef.current) return;
      if (action === 'save') { await saveRecapPng(uri); if (activeRef.current) setMessage('已保存到相册'); }
      else { await shareRecapPng(uri); if (activeRef.current) setMessage('系统分享面板已关闭'); }
    } catch (error) {
      if (activeRef.current) setMessage(messageFor(error, action));
    } finally {
      if (uri) discardRecapPng(uri);
      busyRef.current = false;
      if (activeRef.current) setBusy(false);
    }
  }

  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>回顾图片预览</Text>
    {snapshot === undefined && !loadError ? <ActivityIndicator accessibilityLabel="正在制作图片预览" color={theme.primary} /> : null}
    {loadError ? <Text style={{ color: theme.danger }}>{loadError}</Text> : null}
    {snapshot === null ? <Text style={{ color: theme.mutedText }}>这一年没有符合条件的记录，无法制作图片</Text> : null}
    {snapshot ? <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.preview}><RecapShareCard ref={viewRef} snapshot={snapshot} onReady={onCardReady} /></ScrollView>
      {snapshot.overflowCount ? <Text style={{ color: theme.mutedText }}>图片只展示前 6 本；完整列表可在主题回顾中查看。</Text> : null}
      <Text style={{ color: theme.mutedText }}>图片包含你的书名与封面，分享前请确认。</Text>
      {!ready ? <Text style={{ color: theme.mutedText }}>正在准备封面…</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="保存到相册" accessibilityState={{ disabled: !ready || busy }} disabled={!ready || busy} onPress={() => { void run('save'); }} style={[styles.primary, { backgroundColor: theme.primary }, (!ready || busy) && styles.disabled]}><Text style={[styles.buttonText, { color: theme.card }]}>保存到相册</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="系统分享" accessibilityState={{ disabled: !ready || busy }} disabled={!ready || busy} onPress={() => { void run('share'); }} style={[styles.secondary, { borderColor: theme.primary }, (!ready || busy) && styles.disabled]}><Text style={[styles.buttonText, { color: theme.primary }]}>系统分享</Text></Pressable>
      {message ? <Text accessibilityRole="alert" style={{ color: theme.text }}>{message}</Text> : null}
    </> : null}
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={{ color: theme.primary, fontWeight: '700' }}>返回主题回顾</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: UI_LAYOUT.pageInset, paddingBottom: 100, gap: UI_LAYOUT.sectionGap }, heading: { fontSize: 24, fontWeight: '800' },
  preview: { paddingRight: 2 }, primary: { padding: 16, borderRadius: 12, alignItems: 'center' },
  secondary: { padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  buttonText: { fontWeight: '800', fontSize: 16 }, disabled: { opacity: 0.45 }, back: { paddingVertical: 12, alignItems: 'center' },
});
