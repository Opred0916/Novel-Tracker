import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Tag } from './types';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  searchable?: boolean;
  onCreateTag?: (name: string) => Promise<Tag>;
};

export function TagPicker({ tags, selectedIds, onChange, searchable = false, onCreateTag }: Props) {
  const { theme } = useTheme();
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const visible = tags.filter(tag => tag.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

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
      setQuery('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '添加标签失败');
    } finally {
      setCreating(false);
    }
  }

  return <View style={styles.container}>
    {searchable ? <TextInput placeholder="搜索标签" placeholderTextColor={theme.mutedText} value={query} onChangeText={setQuery} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} /> : null}
    <View style={styles.group}>
      {visible.map(tag => {
        const selected = selectedIds.includes(tag.id);
        return <Pressable key={tag.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}
          onPress={() => changeSelection(selectedIdsRef.current.includes(tag.id)
            ? selectedIdsRef.current.filter(id => id !== tag.id)
            : [...selectedIdsRef.current, tag.id])}
          style={[styles.option, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primarySoft : theme.card }]}>
          <Text style={{ color: selected ? theme.primary : theme.text, fontWeight: selected ? '700' : '500' }}>{tag.name}</Text>
        </Pressable>;
      })}
      {visible.length === 0 ? <Text style={styles.empty}>没有匹配的标签</Text> : null}
    </View>
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
  container: { gap: 10 }, group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#d6cec4', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  selected: { backgroundColor: '#28584E', borderColor: '#28584E' }, text: { color: '#302a25' }, selectedText: { color: '#fff', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  createRow: { flexDirection: 'row', gap: 8 }, createInput: { flex: 1 },
  add: { backgroundColor: '#28584E', borderRadius: 12, justifyContent: 'center', paddingHorizontal: 12 }, addText: { color: '#fff', fontWeight: '600' },
  empty: { color: '#766f68' }, error: { color: '#b52626' },
});
