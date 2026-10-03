import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { shareOpenExport } from '../../export/openExportPlatform';
import type { OpenExportProgress } from '../../export/openExportTypes';
import { useOpenExportService } from '../../storage/AppProvider';
import type { BackupCounts } from '../../backup/backupTypes';

const summary = (counts: BackupCounts): string =>
  `${counts.books} 本小说 · ${counts.readingSessions} 条阅读记录 · ${counts.notes} 条摘记 · ${counts.images} 张图片`;
const stageLabel: Record<OpenExportProgress['stage'], string> = {
  collecting: '正在整理书库…', checking_images: '正在检查图片…', packing: '正在生成开放格式 ZIP…',
};

export default function OpenExportPage() {
  const service = useOpenExportService();
  const [overview, setOverview] = useState<BackupCounts | null>(null);
  const [progress, setProgress] = useState<OpenExportProgress | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const busy = progress !== null;

  useEffect(() => () => { mounted.current = false; }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    service.getOverview().then(value => { if (active) setOverview(value); }).catch(() => { if (active) setError('读取书库信息失败，请重试。'); });
    return () => { active = false; };
  }, [service]));

  const reportProgress = (next: OpenExportProgress) => { if (mounted.current) setProgress(next); };
  async function generate() {
    if (busy) return;
    setError('');
    let operationId: string | null = null;
    try {
      const generated = await service.createExport(reportProgress);
      operationId = generated.operationId;
      await shareOpenExport(generated.uri);
    } catch {
      if (mounted.current) setError('导出或分享失败，当前书库未发生变化。');
    } finally {
      if (operationId) await service.releaseExport(operationId).catch(() => undefined);
      if (mounted.current) setProgress(null);
    }
  }

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.heading}>导出开放格式</Text>
    <Text style={styles.help}>生成一个可在电脑上查看的 ZIP，包含 JSON、CSV 和图片。它是只读副本，不会修改当前书库，也不会替换当前书库。</Text>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>当前书库</Text>
      <Text style={styles.value}>{overview ? summary(overview) : '正在读取…'}</Text>
      <Text style={styles.muted}>导出文件不加密，请妥善保存。</Text>
    </View>
    {progress ? <Text accessibilityLiveRegion="polite" style={styles.progress}>{stageLabel[progress.stage]}</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={generate} style={[styles.primary, busy && styles.disabled]}>
      <Text style={styles.primaryText}>生成并分享</Text>
    </Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14, paddingBottom: 50 },
  heading: { fontSize: 26, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: '#e1dad1' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#302a25' }, value: { color: '#302a25', lineHeight: 22 }, muted: { color: '#817871' },
  progress: { color: '#593f72', fontWeight: '600' }, error: { color: '#b52626', lineHeight: 20 },
  primary: { backgroundColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, disabled: { opacity: 0.5 },
});
