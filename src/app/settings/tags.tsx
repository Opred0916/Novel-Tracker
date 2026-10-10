import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TagPicker } from '../../books/TagPicker';
import type { Tag } from '../../books/types';
import { DEFAULT_QUICK_TAG_NAMES } from '../../storage/database';
import { useTags } from '../../storage/AppProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { UI_LAYOUT } from '../../ui/layout';

export default function QuickTagsPage() {
  const { theme } = useTheme();
  const repo = useTags();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([repo.list(), repo.listQuick()]).then(([all, quick]) => {
      if (!active) return;
      setTags(all);
      setSelectedIds(quick.map(tag => tag.id));
      setLoading(false);
    }).catch(() => { if (active) { setError('读取标签失败'); setLoading(false); } });
    return () => { active = false; };
  }, [repo]);

  function move(id: string, direction: -1 | 1) {
    const index = selectedIds.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedIds(next);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await repo.setQuick(selectedIds);
      router.back();
    } catch {
      setError('保存快捷标签失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.container}><Text style={{ color: theme.text }}>正在读取标签…</Text></View>;
  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text style={[styles.heading, { color: theme.text }]}>快捷标签</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>选择添加小说时优先显示的标签。移除快捷标签不会删除书籍上已有的标签。</Text>
    <TagPicker tags={tags} selectedIds={selectedIds} onChange={setSelectedIds} searchable grouped collapsible />
    <Text style={[styles.heading, { color: theme.text }]}>显示顺序</Text>
    {selectedIds.map(id => {
      const tag = tags.find(item => item.id === id);
      if (!tag) return null;
      return <View key={id} style={styles.row}>
        <Text style={[styles.orderName, { color: theme.text }]}>{tag.name}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${tag.name}上移`} onPress={() => move(id, -1)} style={[styles.move, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}><Text style={{ color: theme.text }}>↑</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${tag.name}下移`} onPress={() => move(id, 1)} style={[styles.move, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}><Text style={{ color: theme.text }}>↓</Text></Pressable>
      </View>;
    })}
    <Pressable accessibilityRole="button" onPress={() => setSelectedIds(DEFAULT_QUICK_TAG_NAMES.map(name => tags.find(tag => tag.name === name)?.id).filter((id): id is string => Boolean(id)))}>
      <Text style={[styles.link, { color: theme.primary }]}>恢复默认快捷标签</Text>
    </Pressable>
    {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.save, { backgroundColor: theme.primary }]}><Text style={styles.saveText}>{saving ? '保存中…' : '保存快捷标签'}</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: UI_LAYOUT.pageInset, gap: 14, paddingBottom: 100 }, heading: { fontSize: 21, fontWeight: '700' },
  help: { color: '#766f68', lineHeight: 20 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderName: { flex: 1, color: '#302a25' }, move: { padding: 10, backgroundColor: '#fff', borderRadius: 10 },
  link: { color: '#28584E', fontWeight: '600', paddingVertical: 12 }, error: { color: '#b52626' },
  save: { backgroundColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center' }, saveText: { color: '#fff', fontWeight: '700' },
});
