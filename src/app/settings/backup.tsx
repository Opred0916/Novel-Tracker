import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pickBackupFile, shareBackup } from '../../backup/backupPlatform';
import type { BackupInspection, BackupProgress } from '../../backup/backupService';
import type { BackupCounts, BackupProgressStage } from '../../backup/backupTypes';
import { BackupValidationError } from '../../backup/backupValidation';
import { useBackupService } from '../../storage/AppProvider';

type Overview = { counts: BackupCounts; lastGeneratedAt: string | null };
const STAGE_LABELS: Record<BackupProgressStage, string> = {
  collecting: '正在整理书库…', packing: '正在生成备份…', validating: '正在验证备份…',
  staging: '正在准备图片…', restoring: '正在恢复书库…', cleaning: '正在清理临时文件…',
};

const summary = (counts: BackupCounts): string =>
  `${counts.books} 本小说 · ${counts.readingSessions} 条阅读记录 · ${counts.notes} 条摘记 · ${counts.images} 张图片`;

function restoreReadError(error: unknown): string {
  if (error instanceof BackupValidationError && error.code === 'unsupported_version') return '备份格式版本过新，当前 App 无法读取；原有数据未发生变化。';
  if (error instanceof BackupValidationError && error.code === 'storage_insufficient') return '设备可用空间不足，无法安全恢复；原有数据未发生变化。';
  if (error instanceof BackupValidationError && error.code === 'archive_too_large') return '备份超过当前安全限制，原有数据未发生变化。';
  return '无法读取这个备份，原有数据未发生变化。';
}

export default function BackupPage() {
  const service = useBackupService();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [error, setError] = useState('');
  const busy = progress !== null;

  async function refresh() {
    try { setOverview(await service.getOverview()); } catch { setError('读取备份信息失败，请重试。'); }
  }

  useEffect(() => {
    void refresh();
  }, [service]);

  useEffect(() => {
    if (!inspection) return undefined;
    return () => { void service.cancelInspection(inspection.token); };
  }, [inspection?.token, service]);

  const reportProgress = (next: BackupProgress) => setProgress(next);

  async function generate() {
    if (busy) return;
    setError('');
    let operationId: string | null = null;
    try {
      const generated = await service.createBackup(reportProgress);
      operationId = generated.operationId;
      await shareBackup(generated.uri);
      await refresh();
    } catch {
      setError('生成或分享备份失败，请重试。');
    } finally {
      if (operationId) await service.releaseGeneratedBackup(operationId).catch(() => undefined);
      setProgress(null);
    }
  }

  async function chooseRestore() {
    if (busy) return;
    setError('');
    try {
      const uri = await pickBackupFile();
      if (!uri) return;
      const next = await service.inspectBackup(uri, reportProgress);
      setInspection(next);
    } catch (restoreError) {
      setError(restoreReadError(restoreError));
    } finally {
      setProgress(null);
    }
  }

  async function cancelRestore() {
    if (!inspection) return;
    const token = inspection.token;
    setInspection(null);
    await service.cancelInspection(token).catch(() => undefined);
  }

  function confirmRestore() {
    if (!inspection || busy) return;
    Alert.alert(
      '完整替换当前书库？',
      '当前小说、阅读记录、摘记和图片会被此备份完整替换。此操作不能撤销。',
      [
        { text: '取消', style: 'cancel' },
        { text: '替换并恢复', style: 'destructive', onPress: () => { void restore(); } },
      ],
    );
  }

  async function restore() {
    if (!inspection) return;
    setError('');
    try {
      await service.restore(inspection.token, reportProgress);
      setInspection(null);
      await refresh();
      router.replace('/');
    } catch {
      setError('恢复失败，原有数据未发生变化。');
    } finally {
      setProgress(null);
    }
  }

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.heading}>备份与恢复</Text>
    <Text style={styles.help}>备份包含书籍、阅读记录、摘记和图片，也可能包含私人内容，请妥善保存。</Text>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>当前书库</Text>
      <Text style={styles.value}>{overview ? summary(overview.counts) : '正在读取…'}</Text>
      <Text style={styles.muted}>{overview?.lastGeneratedAt ? `上次生成备份：${new Date(overview.lastGeneratedAt).toLocaleString()}` : '尚未生成备份'}</Text>
    </View>
    {progress ? <Text accessibilityLiveRegion="polite" style={styles.progress}>{STAGE_LABELS[progress.stage]}</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={generate} style={[styles.primary, busy && styles.disabled]}>
      <Text style={styles.primaryText}>生成备份</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={chooseRestore} style={[styles.secondary, busy && styles.disabled]}>
      <Text style={styles.secondaryText}>从备份恢复</Text>
    </Pressable>
    {inspection ? <View style={[styles.card, styles.warning]}>
      <Text style={styles.cardTitle}>备份预览</Text>
      <Text style={styles.value}>{summary(inspection.counts)}</Text>
      <Text style={styles.warningText}>这会完整替换当前书库</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={confirmRestore} style={styles.danger}><Text style={styles.primaryText}>确认恢复</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={cancelRestore} style={styles.cancel}><Text style={styles.secondaryText}>取消恢复</Text></Pressable>
    </View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14, paddingBottom: 50 },
  heading: { fontSize: 26, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: '#e1dad1' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#302a25' }, value: { color: '#302a25', lineHeight: 22 },
  muted: { color: '#817871' }, progress: { color: '#593f72', fontWeight: '600' }, error: { color: '#b52626', lineHeight: 20 },
  primary: { backgroundColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' }, secondaryText: { color: '#593f72', fontWeight: '700' }, disabled: { opacity: 0.5 },
  warning: { borderColor: '#c48235' }, warningText: { color: '#9a5719', fontWeight: '700' },
  danger: { backgroundColor: '#a33b35', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  cancel: { padding: 10, alignItems: 'center' },
});
