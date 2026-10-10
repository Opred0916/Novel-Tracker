import { randomUUID } from 'expo-crypto';
import { useContext, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { TagPicker } from './TagPicker';
import { BOOK_TYPE_LABELS } from './TypePicker';
import { BOOK_TYPES, type BookType, type Tag } from './types';
import { type BulkOrganizeDraft, type BulkOrganizePreview } from './bulkOrganize';
import type { SqliteBulkOrganizeRepository } from './bulkOrganizeRepository';
import { useTheme } from '../theme/ThemeProvider';

type SelectedBook = { title: string; author: string | null };

export function BulkOrganizePanel({ selectedBooks, tags, repository, onComplete, onCancel }: {
  selectedBooks: Map<string, SelectedBook>;
  tags: Tag[];
  repository: SqliteBulkOrganizeRepository;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const [addTagIds, setAddTagIds] = useState<string[]>([]);
  const [removeTagIds, setRemoveTagIds] = useState<string[]>([]);
  const [pendingTags, setPendingTags] = useState<Tag[]>([]);
  const [typeChange, setTypeChange] = useState<BulkOrganizeDraft['typeChange']>({ kind: 'keep' });
  const [preview, setPreview] = useState<BulkOrganizePreview | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const allTags = [...tags, ...pendingTags];

  function changeAddTags(ids: string[]) {
    const next = ids.filter(id => !removeTagIds.includes(id));
    setAddTagIds(next);
    setPreview(null);
    setError('');
  }

  function changeRemoveTags(ids: string[]) {
    const next = ids.filter(id => !addTagIds.includes(id));
    setRemoveTagIds(next);
    setPreview(null);
    setError('');
  }

  async function createPendingTag(name: string): Promise<Tag> {
    const normalized = name.trim();
    if (!normalized) throw new Error('请输入标签名称');
    if (allTags.some(tag => tag.name.normalize('NFKC').trim().toLocaleLowerCase() === normalized.normalize('NFKC').toLocaleLowerCase())) {
      throw new Error('标签名称已存在');
    }
    const tag: Tag = { id: randomUUID(), name: normalized, isSystem: false };
    setPendingTags(current => [...current, tag]);
    return tag;
  }

  function currentDraft(): BulkOrganizeDraft {
    return {
      addTagIds,
      removeTagIds,
      newTags: pendingTags.filter(tag => addTagIds.includes(tag.id)).map(({ id, name }) => ({ id, name })),
      typeChange,
    };
  }

  async function buildPreview() {
    if (!addTagIds.length && !removeTagIds.length && typeChange.kind === 'keep') {
      setError('至少选择一项操作');
      setPreview(null);
      return;
    }
    setError('');
    try {
      const next = await repository.preview([...selectedBooks.keys()], currentDraft());
      setPreview(next);
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : '预览失败，请重试');
    }
  }

  async function applyPreview() {
    if (!preview || !preview.changedCount || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await repository.apply(preview);
      onComplete();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(message.includes('预览已过期') ? '预览已过期，请返回重新生成' : '保存失败，请重试');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function tagName(id: string): string {
    return allTags.find(tag => tag.id === id)?.name ?? id;
  }

  function typeName(value: BookType | null): string {
    return value ? BOOK_TYPE_LABELS[value] : '未分类';
  }

  return <View style={styles.root}>
    <View testID="bulk-organize-header" style={[styles.header, { paddingTop: (insets?.top ?? 0) + 12, backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={styles.headerBack}><Text style={[styles.link, { color: theme.primary }]}>返回选择</Text></Pressable>
      <Text style={[styles.heading, { color: theme.text }]}>批量整理 {selectedBooks.size} 本小说</Text>
    </View>
  <ScrollView testID="bulk-organize-scroll" contentContainerStyle={{ ...styles.container, paddingBottom: (insets?.bottom ?? 0) + 50 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text style={[styles.help, { color: theme.mutedText }]}>只会修改标签和作品类型，阅读状态、评分、摘记和图片不会改变。</Text>
    <Text style={[styles.label, { color: theme.text }]}>添加标签（可多选）</Text>
    <TagPicker tags={allTags} selectedIds={addTagIds} onChange={changeAddTags} searchable grouped collapsible onCreateTag={createPendingTag} />
    <Text style={[styles.label, { color: theme.text }]}>移除标签（可多选）</Text>
    <TagPicker tags={allTags} selectedIds={removeTagIds} onChange={changeRemoveTags} searchable grouped collapsible />
    <Text style={[styles.label, { color: theme.text }]}>作品类型</Text>
    <View style={styles.options}>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: typeChange.kind === 'keep' }} onPress={() => { setTypeChange({ kind: 'keep' }); setPreview(null); }} style={[styles.option, { backgroundColor: typeChange.kind === 'keep' ? theme.primary : theme.card, borderColor: typeChange.kind === 'keep' ? theme.primary : theme.border }]}><Text style={{ color: typeChange.kind === 'keep' ? theme.card : theme.text, fontWeight: typeChange.kind === 'keep' ? '700' : '500' }}>保持各书原样</Text></Pressable>
      {BOOK_TYPES.map(type => { const selected = typeChange.kind === 'set' && typeChange.value === type; return <Pressable key={type} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { setTypeChange({ kind: 'set', value: type }); setPreview(null); }} style={[styles.option, { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.border }]}><Text style={{ color: selected ? theme.card : theme.text, fontWeight: selected ? '700' : '500' }}>{BOOK_TYPE_LABELS[type]}</Text></Pressable>; })}
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: typeChange.kind === 'clear' }} onPress={() => { setTypeChange({ kind: 'clear' }); setPreview(null); }} style={[styles.option, { backgroundColor: typeChange.kind === 'clear' ? theme.primary : theme.card, borderColor: typeChange.kind === 'clear' ? theme.primary : theme.border }]}><Text style={{ color: typeChange.kind === 'clear' ? theme.card : theme.text, fontWeight: typeChange.kind === 'clear' ? '700' : '500' }}>清空类型</Text></Pressable>
    </View>
    {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void buildPreview(); }} style={[styles.primary, { backgroundColor: theme.primary }]}><Text style={styles.primaryText}>生成预览</Text></Pressable>
    </View>
    {preview ? <View style={styles.preview}>
      <Text style={[styles.previewTitle, { color: theme.text }]}>修改预览</Text>
      <Text style={{ color: theme.text }}>已选 {preview.selectedCount} 本</Text>
      <Text style={{ color: theme.text }}>实际会变化 {preview.changedCount} 本</Text>
      <Text style={{ color: theme.text }}>无变化 {preview.unchangedCount} 本</Text>
      {preview.changedCount === 0 ? <Text style={[styles.error, { color: theme.danger }]}>没有需要修改的内容</Text> : null}
      {preview.items.map(item => <View key={item.before.id} style={styles.previewItem}>
        <Text style={[styles.itemTitle, { color: theme.text }]}>{item.before.title}{item.before.author ? ` · ${item.before.author}` : ''}</Text>
        <Text style={{ color: theme.text }}>标签：{item.before.tagIds.map(tagName).join('、') || '无'} → {item.after.tagIds.map(tagName).join('、') || '无'}</Text>
        <Text style={{ color: theme.text }}>类型：{typeName(item.before.bookType)} → {typeName(item.after.bookType)}</Text>
      </View>)}
      <Pressable accessibilityRole="button" disabled={saving || preview.changedCount === 0} accessibilityState={{ disabled: saving || preview.changedCount === 0 }} onPress={() => { void applyPreview(); }} style={[styles.primary, { backgroundColor: theme.primary }, (saving || preview.changedCount === 0) && styles.disabled]}><Text style={styles.primaryText}>{saving ? '保存中…' : '确认修改'}</Text></Pressable>
    </View> : null}
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { paddingHorizontal: 24, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 }, headerBack: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center' },
  container: { padding: 24, gap: 12, paddingBottom: 50 }, heading: { fontSize: 22, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25', marginTop: 8 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' }, selected: { backgroundColor: '#28584E', borderColor: '#28584E' }, text: { color: '#302a25' }, selectedText: { color: '#fff', fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }, link: { color: '#28584E', fontWeight: '600', padding: 8 }, primary: { backgroundColor: '#28584E', borderRadius: 12, padding: 14, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, disabled: { opacity: 0.5 }, error: { color: '#b52626' },
  preview: { gap: 8, marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#d6cec4' }, previewTitle: { fontSize: 19, fontWeight: '700', color: '#302a25' }, previewItem: { gap: 4, backgroundColor: '#fff', padding: 12, borderRadius: 12 }, itemTitle: { fontWeight: '700', color: '#302a25' },
});
