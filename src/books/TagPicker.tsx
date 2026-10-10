import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Tag } from './types';
import { useTheme } from '../theme/ThemeProvider';
import { ChoiceChip } from '../ui/ChoiceChip';
import { groupTags } from './tagCategories';

type Props = {
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  searchable?: boolean;
  showSelectedWhenEmpty?: boolean;
  grouped?: boolean;
  collapsible?: boolean;
  onCreateTag?: (name: string) => Promise<Tag>;
};

export function TagPicker({ tags, selectedIds, onChange, searchable = false, showSelectedWhenEmpty = false, grouped = false, collapsible = false, onCreateTag }: Props) {
  const { theme } = useTheme();
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(() => groupTags(tags.filter(tag => selectedIds.includes(tag.id))).map(group => group.title));
  const search = query.trim().toLocaleLowerCase();
  const visible = tags.filter(tag => search ? tag.name.toLocaleLowerCase().includes(search) : !showSelectedWhenEmpty || selectedIds.includes(tag.id));

  function changeSelection(ids: string[]) {
    selectedIdsRef.current = ids;
    onChange(ids);
  }

  async function createTag() {
    const name = newName.trim();
    if (!name) { setError('请输入标签名称'); return; }
    if (!onCreateTag || creating) return;
    setCreating(true);
    setError('');
    try {
      const tag = await onCreateTag(name);
      changeSelection([...new Set([...selectedIdsRef.current, tag.id])]);
      setNewName('');
      setQuery(name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '添加标签失败');
    } finally {
      setCreating(false);
    }
  }

  function chips(items: Tag[]) {
    return items.map(tag => {
      const selected = selectedIds.includes(tag.id);
      return <ChoiceChip key={tag.id} label={tag.name} selected={selected} selectionRole="checkbox"
        onPress={() => changeSelection(selectedIdsRef.current.includes(tag.id)
          ? selectedIdsRef.current.filter(id => id !== tag.id)
          : [...selectedIdsRef.current, tag.id])} />;
    });
  }

  return <View style={styles.container}>
    {searchable ? <TextInput placeholder="搜索标签" placeholderTextColor={theme.mutedText} value={query} onChangeText={setQuery} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} /> : null}
    {grouped ? groupTags(visible).map(group => <View key={group.title} style={styles.category}>
      {collapsible && !search ? <Pressable accessibilityRole="button" accessibilityLabel={`${expanded.includes(group.title) ? '收起' : '展开'}${group.title}`} onPress={() => setExpanded(current => current.includes(group.title) ? current.filter(title => title !== group.title) : [...current, group.title])} style={[styles.categoryRow, { borderColor: theme.border }]}>
        <Text style={[styles.categoryTitle, { color: theme.text }]}>{group.title}</Text>
        <Text style={{ color: theme.mutedText }}>{group.tags.filter(tag => selectedIds.includes(tag.id)).length ? `已选 ${group.tags.filter(tag => selectedIds.includes(tag.id)).length} · ` : ''}{group.tags.length} 个　{expanded.includes(group.title) ? '⌃' : '⌄'}</Text>
      </Pressable> : <Text style={[styles.categoryTitle, { color: theme.mutedText }]}>{group.title}</Text>}
      {!collapsible || search || expanded.includes(group.title) ? <View style={styles.group}>{chips(group.tags)}</View> : null}
    </View>) : <View style={styles.group}>{chips(visible)}</View>}
    {visible.length === 0 ? <Text style={styles.empty}>{showSelectedWhenEmpty && !search ? '还没有选择标签，输入名称查找' : '没有匹配的标签'}</Text> : null}
    {onCreateTag ? <View style={styles.createRow}>
      <TextInput placeholder="新标签名称" placeholderTextColor={theme.mutedText} value={newName} onChangeText={setNewName} style={[styles.input, styles.createInput, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
      <Pressable accessibilityRole="button" disabled={creating} onPress={createTag} style={[styles.add, { backgroundColor: theme.primary }]}>
        <Text style={styles.addText}>添加标签</Text>
      </Pressable>
    </View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 12 }, group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, category: { gap: 8 }, categoryTitle: { fontSize: 15, fontWeight: '700' }, categoryRow: { borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  createRow: { flexDirection: 'row', gap: 8 }, createInput: { flex: 1 },
  add: { backgroundColor: '#28584E', borderRadius: 12, justifyContent: 'center', paddingHorizontal: 12 }, addText: { color: '#fff', fontWeight: '600' },
  empty: { color: '#766f68' }, error: { color: '#b52626' },
});
