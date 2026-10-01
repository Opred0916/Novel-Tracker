import React, { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { normalizeReadingDates, todayLocalDate } from './readingDates';
import { ReadingDateFields } from './ReadingDateFields';
import type { ReadingSession } from './types';

export function ReadingHistoryForm({ session, legacy = false, onSave, onDelete }: {
  session?: ReadingSession;
  legacy?: boolean;
  onSave: (startedOn: string, endedOn: string | null) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [startedOn, setStartedOn] = useState(session?.startedOn ?? todayLocalDate);
  const [endedOn, setEndedOn] = useState(session?.endedOn ?? todayLocalDate);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const outcome = session?.outcome ?? 'finished';

  async function save() {
    if (savingRef.current) return;
    let dates;
    try { dates = normalizeReadingDates(outcome, startedOn, outcome === 'reading' ? null : endedOn); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '日期无效'); return; }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try { await onSave(dates.startedOn, dates.endedOn); }
    catch { setError('保存失败，请重试'); }
    finally { savingRef.current = false; setSaving(false); }
  }

  function confirmDelete() {
    if (!onDelete || savingRef.current) return;
    Alert.alert('删除这次阅读？', '这条阅读记录会被删除；若是最新一次，书籍状态可能回退。', [
      { text: '取消', style: 'cancel' },
      { text: '确认删除', style: 'destructive', onPress: () => {
        savingRef.current = true;
        setSaving(true);
        setError('');
        void onDelete().catch(() => setError('删除失败，请重试')).finally(() => {
          savingRef.current = false;
          setSaving(false);
        });
      } },
    ]);
  }

  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text style={styles.heading}>{legacy ? '补记首刷日期' : `编辑第 ${session?.ordinal} 次阅读`}</Text>
    <ReadingDateFields startedOn={startedOn} endedOn={endedOn} showEnd={outcome !== 'reading'}
      onStartChange={setStartedOn} onEndChange={setEndedOn} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void save(); }} style={styles.save}>
      <Text style={styles.saveText}>{saving ? '保存中…' : '保存日期'}</Text>
    </Pressable>
    {session && onDelete ? <Pressable accessibilityRole="button" disabled={saving} onPress={confirmDelete} style={styles.delete}>
      <Text style={styles.deleteText}>删除本次阅读</Text>
    </Pressable> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, paddingBottom: 50 },
  heading: { fontSize: 22, fontWeight: '700', color: '#302a25' },
  error: { color: '#b52626' },
  save: { backgroundColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
  delete: { padding: 14, alignItems: 'center' },
  deleteText: { color: '#b52626', fontWeight: '600' },
});
