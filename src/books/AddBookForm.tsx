import React, { useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RatingField } from './RatingField';
import { ReadingDateFields } from './ReadingDateFields';
import { todayLocalDate } from './readingDates';
import { TagPicker } from './TagPicker';
import { TypePicker } from './TypePicker';
import { BOOK_STATUS_LABELS } from './status';
import { BOOK_STATUSES, type BookInput, type BookStatus, type BookType, type Tag } from './types';
import { normalizeBookCreate } from './validation';
import { BookCoverField } from './BookCoverField';
import type { StagedCover } from './bookCoverFiles';
import { useTheme } from '../theme/ThemeProvider';
import { BottomSheet } from '../ui/BottomSheet';
import { SuggestionField } from './SuggestionField';
import { GroupedSection } from '../ui/GroupedSection';
import { UI_LAYOUT } from '../ui/layout';

export function AddBookForm({ onSave, quickTags = [], allTags = [], authorSuggestions = [], platformSuggestions = [], onRemoveAuthorSuggestion, onRemovePlatformSuggestion }: { onSave: (input: BookInput) => Promise<void>; quickTags?: Tag[]; allTags?: Tag[]; authorSuggestions?: string[]; platformSuggestions?: string[]; onRemoveAuthorSuggestion?: (value: string) => void; onRemovePlatformSuggestion?: (value: string) => void }) {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [whyWantToRead, setWhyWantToRead] = useState('');
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState<BookStatus>('want_to_read');
  const [startedOn, setStartedOn] = useState(todayLocalDate);
  const [endedOn, setEndedOn] = useState(todayLocalDate);
  const [protagonists, setProtagonists] = useState(['', '']);
  const [ratingHalfStars, setRatingHalfStars] = useState<number | null>(null);
  const [bookType, setBookType] = useState<BookType | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [pendingTags, setPendingTags] = useState<Tag[]>([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [coverSource, setCoverSource] = useState<StagedCover | undefined>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  function changeProtagonist(index: number, value: string) {
    setProtagonists(current => current.map((name, nameIndex) => nameIndex === index ? value : name));
  }

  async function save() {
    if (savingRef.current) return;
    let input: BookInput;
    try {
      input = normalizeBookCreate({
        title, author, status, protagonists, bookType, tagIds, whyWantToRead: status === 'want_to_read' ? whyWantToRead : null, platform,
        ...(pendingTags.some(tag => tagIds.includes(tag.id)) ? { newTags: pendingTags.filter(tag => tagIds.includes(tag.id)).map(({ id, name }) => ({ id, name })) } : {}),
        ratingHalfStars: status === 'finished' ? ratingHalfStars : null,
        coverSource,
        ...(status !== 'want_to_read' ? { readingDates: { startedOn, endedOn: status === 'reading' ? null : endedOn } } : {}),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '输入有误');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try { await onSave(input); }
    catch { setError('保存失败，请重试'); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
    <GroupedSection><View style={styles.groupContent}>
    <BookCoverField title={title} onChange={value => setCoverSource(value ?? undefined)} />
    <Text style={[styles.label, { color: theme.text }]}>书名 *</Text>
    <TextInput placeholder="输入小说书名" placeholderTextColor={theme.mutedText} value={title} onChangeText={setTitle} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} autoFocus />
    <Text style={[styles.help, { color: theme.mutedText }]}>只填书名也能保存，其他资料可以现在填写或以后补充。</Text>
    </View></GroupedSection>
    <GroupedSection title="基本信息"><View style={styles.groupContent}>
    <SuggestionField label="作者" placeholder="作者名字" value={author} onChange={setAuthor} suggestions={authorSuggestions} onRemoveSuggestion={onRemoveAuthorSuggestion} />
    <SuggestionField label="首发平台" placeholder="首发平台（可选）" value={platform} onChange={setPlatform} suggestions={platformSuggestions} onRemoveSuggestion={onRemovePlatformSuggestion} />
    <Text style={[styles.label, { color: theme.text }]}>主角名字</Text>
    {protagonists.map((name, index) => <View key={index} style={styles.nameRow}>
      <View style={styles.nameHeading}><Text style={[styles.nameLabel, { color: theme.mutedText }]}>主角 {index + 1}</Text><Pressable accessibilityRole="button" accessibilityLabel={`删除主角 ${index + 1}`} onPress={() => setProtagonists(current => current.filter((_, row) => row !== index))}><Text style={[styles.addNameText, { color: theme.primary }]}>删除</Text></Pressable></View>
      <TextInput accessibilityLabel={`主角 ${index + 1}`} placeholder="主角名字" placeholderTextColor={theme.mutedText} value={name}
        onChangeText={value => changeProtagonist(index, value)} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
    </View>)}
    {protagonists.length < 8 ? <Pressable accessibilityRole="button" onPress={() => setProtagonists(current => current.length < 8 ? [...current, ''] : current)} style={styles.addName}>
      <Text style={[styles.addNameText, { color: theme.primary }]}>＋ 添加主角</Text><Text style={[styles.nameLabel, { color: theme.mutedText }]}>最多 8 位</Text>
    </Pressable> : null}
    </View></GroupedSection>
    <GroupedSection title="阅读信息"><View style={styles.groupContent}>
    <Text style={[styles.label, { color: theme.text }]}>阅读状态</Text>
    <View style={styles.statusGroup}>
      {BOOK_STATUSES.map(choice => <Pressable key={choice} accessibilityRole="radio"
        accessibilityState={{ checked: status === choice }} onPress={() => setStatus(choice)}
        style={[styles.statusOption, { borderColor: status === choice ? theme.primary : theme.border, backgroundColor: status === choice ? theme.primary : theme.card }]}>
        <Text style={{ color: status === choice ? theme.card : theme.text, fontWeight: status === choice ? '700' : '500' }}>{BOOK_STATUS_LABELS[choice]}</Text>
      </Pressable>)}
    </View>
    {status === 'want_to_read' ? <View>
      <Text style={[styles.label, { color: theme.text }]}>想读理由（可选）</Text>
      <TextInput placeholder="记下吸引你的原因" placeholderTextColor={theme.mutedText} value={whyWantToRead} onChangeText={setWhyWantToRead}
        style={[styles.input, styles.multiline, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} multiline textAlignVertical="top" />
    </View> : null}
    {status !== 'want_to_read' ? <ReadingDateFields startedOn={startedOn} endedOn={endedOn}
      showEnd={status !== 'reading'} onStartChange={setStartedOn} onEndChange={setEndedOn} /> : null}
    {status === 'finished' ? <RatingField value={ratingHalfStars} onChange={setRatingHalfStars} allowNewValue /> : null}
    </View></GroupedSection>
    <GroupedSection title="分类与标签"><View style={styles.groupContent}>
    <Text style={[styles.label, { color: theme.text }]}>作品类型</Text>
    <TypePicker value={bookType} onChange={setBookType} />
    <Text style={[styles.label, { color: theme.text }]}>快捷标签</Text>
    <TagPicker tags={quickTags} selectedIds={tagIds} onChange={setTagIds} />
    <Pressable accessibilityRole="button" onPress={() => setShowAllTags(true)} style={[styles.allTagsButton, { borderColor: theme.primary }]}><Text style={[styles.allTagsText, { color: theme.primary }]}>全部标签</Text></Pressable>
    </View></GroupedSection>
    {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.button, { backgroundColor: theme.primary }]}>
      <Text style={styles.buttonText}>{saving ? '保存中…' : '保存小说'}</Text>
    </Pressable>
    <BottomSheet visible={showAllTags} title="全部标签" onClose={() => setShowAllTags(false)}>
      <TagPicker tags={[...allTags, ...pendingTags]} selectedIds={tagIds} onChange={setTagIds} searchable grouped collapsible onCreateTag={async name => {
        const normalized = name.trim();
        if ([...allTags, ...pendingTags].some(tag => tag.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) throw new Error('标签名称已存在');
        const tag = { id: randomUUID(), name: normalized, isSystem: false };
        setPendingTags(current => [...current, tag]);
        return tag;
      }} />
    </BottomSheet>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: UI_LAYOUT.pageInset, gap: UI_LAYOUT.sectionGap, paddingBottom: 120 },
  groupContent: { padding: 16, gap: 10 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25', marginTop: 8 },
  input: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: '#fff' },
  multiline: { minHeight: 84 },
  help: { color: '#766f68', fontSize: 13 },
  statusGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  statusSelected: { backgroundColor: '#28584E', borderColor: '#28584E' },
  statusText: { color: '#302a25' },
  statusSelectedText: { color: '#fff', fontWeight: '700' },
  nameRow: { gap: 6 }, nameHeading: { flexDirection: 'row', justifyContent: 'space-between' },
  nameLabel: { color: '#766f68' },
  addName: { padding: 12, alignSelf: 'flex-start', flexDirection: 'row', gap: 8 },
  addNameText: { color: '#28584E', fontWeight: '600' },
  allTagsButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }, allTagsText: { fontWeight: '700' },
  error: { color: '#b52626' },
  button: { backgroundColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
