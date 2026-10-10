import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { conflictChoiceKey, type ConflictChoices, type SyncConflict } from '../../sync/merge';
import { useSync } from '../../sync/SyncProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { UI_LAYOUT } from '../../ui/layout';

const LABELS: Record<string, string> = {
  books: '小说', protagonists: '主角', tags: '标签', bookTags: '小说标签', quickTags: '快捷标签',
  readingSessions: '阅读记录', notes: '摘记', noteImages: '摘记图片', highlightImages: '精彩片段', images: '图片', structure: '关联记录',
};

function describe(value: unknown): string {
  if (value === null) return '已删除';
  if (typeof value !== 'object' || value === null) return String(value);
  const record = value as Record<string, unknown>;
  const main = record.title ?? record.body ?? record.name ?? record.outcome;
  return String(main ?? JSON.stringify(value)).slice(0, 180);
}

export default function SyncConflictsPage() {
  const sync = useSync();
  const { theme } = useTheme();
  const [choices, setChoices] = useState<ConflictChoices>({});
  const [busy, setBusy] = useState(false);
  const structural = sync.conflicts.some(item => item.collection === 'structure');
  const unresolved = sync.conflicts.filter(item => item.collection !== 'structure' && !choices[conflictChoiceKey(item)]);

  async function applyChoices() {
    setBusy(true);
    try { await sync.resolve(choices); }
    finally { setBusy(false); }
  }

  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>处理同步冲突</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>两台设备改动了同一条记录。选择要保留的一版后再继续，未选版本不会自动保存。处理前请分别备份两台设备。</Text>
    {sync.conflicts.map((conflict: SyncConflict) => {
      const key = conflictChoiceKey(conflict);
      return <View key={key} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>{LABELS[conflict.collection]} · {conflict.key.replace(/\0/g, ' / ')}</Text>
        {conflict.collection === 'structure' ? <Text style={[styles.help, { color: theme.danger }]}>{conflict.reason ?? '关联记录无法自动合并。请先分别备份并调整记录，再重试同步。'}</Text> : <>
          <Text style={[styles.help, { color: theme.mutedText }]}>本机：{describe(conflict.local)}</Text>
          <Text style={[styles.help, { color: theme.mutedText }]}>云端：{describe(conflict.remote)}</Text>
          <View style={styles.actions}>{(['local', 'remote'] as const).map(side => <Pressable key={side} accessibilityRole="button" onPress={() => setChoices(current => ({ ...current, [key]: side }))} style={[styles.choice, { borderColor: theme.primary, backgroundColor: choices[key] === side ? theme.primary : theme.card }]}><Text style={{ color: choices[key] === side ? theme.card : theme.primary, fontWeight: '700' }}>{side === 'local' ? '保留本机' : '保留云端'}</Text></Pressable>)}</View>
        </>}
      </View>;
    })}
    {structural ? <Pressable accessibilityRole="button" onPress={() => router.push('/settings/backup')} style={[styles.choice, { borderColor: theme.primary }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>先备份本机</Text></Pressable> : null}
    {!structural && sync.conflicts.length ? <Pressable accessibilityRole="button" disabled={busy || unresolved.length > 0} onPress={() => { void applyChoices(); }} style={[styles.primary, { backgroundColor: theme.primary, opacity: busy || unresolved.length ? 0.5 : 1 }]}><Text style={{ color: theme.card, fontWeight: '700' }}>{busy ? '正在处理' : '确认选择并继续同步'}</Text></Pressable> : null}
    {sync.status === 'synced' ? <Text style={[styles.help, { color: theme.primary }]}>冲突已处理，同步完成。</Text> : null}
    {sync.error ? <Text accessibilityRole="alert" style={[styles.help, { color: theme.danger }]}>{sync.error}</Text> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: UI_LAYOUT.pageInset, gap: 16, paddingBottom: 48 },
  heading: { fontSize: 28, fontWeight: '800' },
  help: { fontSize: 15, lineHeight: 23 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: UI_LAYOUT.groupRadius, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  primary: { borderRadius: 12, padding: 16, alignItems: 'center' },
});
