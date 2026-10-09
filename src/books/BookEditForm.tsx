import React, { useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BOOK_STATUS_LABELS } from './status';
import { RatingField } from './RatingField';
import { ReadingDateFields } from './ReadingDateFields';
import { todayLocalDate } from './readingDates';
import { TagPicker } from './TagPicker';
import { TypePicker } from './TypePicker';
import { BOOK_STATUSES, type Book, type BookEditInput, type BookStatus, type BookType, type ReadingSession, type Tag } from './types';
import { normalizeBookEdit } from './validation';
import { BookCoverField } from './BookCoverField';
import type { StagedCover } from './bookCoverFiles';
import { useTheme } from '../theme/ThemeProvider';
import { BottomSheet } from '../ui/BottomSheet';
import { SuggestionField } from './SuggestionField';
import { GroupedSection } from '../ui/GroupedSection';
import { UI_LAYOUT } from '../ui/layout';

export function BookEditForm({ book, onSave, allTags = [], quickTags = [], authorSuggestions = [], platformSuggestions = [], sessions = [] }: {
  book: Book; onSave: (input: BookEditInput) => Promise<void>;
  allTags?: Tag[];
  quickTags?: Tag[];
  authorSuggestions?: string[];
  platformSuggestions?: string[];
  sessions?: ReadingSession[];
}) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? '');
  const [whyWantToRead, setWhyWantToRead] = useState(book.whyWantToRead ?? '');
  const [platform, setPlatform] = useState(book.platform ?? '');
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [startedOn, setStartedOn] = useState(todayLocalDate);
  const [endedOn, setEndedOn] = useState(todayLocalDate);
  const [ratingHalfStars, setRatingHalfStars] = useState(book.ratingHalfStars);
  const [ratingCleared, setRatingCleared] = useState(false);
  const [bookType, setBookType] = useState<BookType | null>(book.bookType);
  const [tagIds, setTagIds] = useState<string[]>(book.tags.map(tag => tag.id));
  const [pendingTags, setPendingTags] = useState<Tag[]>([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [coverChange, setCoverChange] = useState<BookEditInput['coverChange']>({ kind: 'keep' });
  const [protagonists, setProtagonists] = useState<string[]>([
    ...book.protagonists,
    ...Array(Math.max(0, 2 - book.protagonists.length)).fill(''),
  ]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const effectiveRatingHalfStars = status === 'finished'
    ? ratingHalfStars
    : ratingCleared ? null : book.ratingHalfStars;
  const activeSession = sessions.find(session => session.outcome === 'reading');
  const changingStatus = status !== book.status;
  const nextOrdinal = Math.max(book.legacyReadCount, ...sessions.map(session => session.ordinal), 0) + 1;
  const previewOrdinal = book.status === 'reading' && activeSession && status !== 'reading'
    ? activeSession.ordinal : nextOrdinal;

  function changeStatus(choice: BookStatus) {
    setStatus(choice);
    if (choice !== book.status) {
      setStartedOn(book.status === 'reading' && choice !== 'reading' ? activeSession?.startedOn ?? todayLocalDate() : todayLocalDate());
      setEndedOn(todayLocalDate());
    }
  }

  function changeProtagonist(index: number, value: string) {
    setProtagonists(current => current.map((name, nameIndex) => nameIndex === index ? value : name));
  }

  async function createPendingTag(name: string): Promise<Tag> {
    const normalized = name.trim();
    if ([...allTags, ...pendingTags].some(tag => tag.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
      throw new Error('标签名称已存在');
    }
    const tag: Tag = { id: randomUUID(), name: normalized, isSystem: false };
    setPendingTags(current => [...current, tag]);
    return tag;
  }

  async function performSave(input: BookEditInput) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try { await onSave(input); }
    catch { setError('保存失败，请重试'); }
    finally { savingRef.current = false; setSaving(false); }
  }

  function save() {
    if (savingRef.current) return;
    try {
      const input = normalizeBookEdit({
        title, author, status, protagonists, ratingHalfStars: effectiveRatingHalfStars, bookType, tagIds,
        whyWantToRead, platform,
        ...(changingStatus && status !== 'want_to_read' ? {
          readingDates: { startedOn, endedOn: status === 'reading' ? null : endedOn },
        } : {}),
        ...(pendingTags.some(tag => tagIds.includes(tag.id)) ? {
          newTags: pendingTags.filter(tag => tagIds.includes(tag.id)).map(({ id, name }) => ({ id, name })),
        } : {}),
        ...(coverChange && coverChange.kind !== 'keep' ? { coverChange } : {}),
      });
      if (book.status === 'reading' && status === 'want_to_read' && activeSession) {
        Alert.alert('取消本次阅读？', '这会移除尚未结束的阅读记录，已结束的历史不受影响。', [
          { text: '返回', style: 'cancel' },
          { text: '确认取消', style: 'destructive', onPress: () => { void performSave(input); } },
        ]);
        return;
      }
      void performSave(input);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '输入有误');
    }
  }

  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
    <GroupedSection><View style={styles.groupContent}>
    <BookCoverField title={title} initialUri={book.coverUri} onChange={(value: StagedCover | null, removed) => {
      if (value) setCoverChange({ kind: 'set', source: value });
      else setCoverChange(removed && book.coverUri ? { kind: 'remove' } : { kind: 'keep' });
    }} />
    <Text style={[styles.label, { color: theme.text }]}>书名 *</Text>
    <TextInput placeholder="输入小说书名" placeholderTextColor={theme.mutedText} value={title} onChangeText={setTitle} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
    </View></GroupedSection>
    <GroupedSection title="基本信息"><View style={styles.groupContent}>
    <SuggestionField label="作者" placeholder="作者名字" value={author} onChange={setAuthor} suggestions={authorSuggestions} />
    <SuggestionField label="首发平台" placeholder="首发平台（可选）" value={platform} onChange={setPlatform} suggestions={platformSuggestions} />
    <Text style={[styles.label, { color: theme.text }]}>主角名字</Text>
    {protagonists.map((name, index) => <View key={index} style={styles.nameRow}>
      <Text style={[styles.nameLabel, { color: theme.mutedText }]}>主角 {index + 1}</Text>
      <TextInput accessibilityLabel={`主角 ${index + 1}`} placeholder="主角名字" placeholderTextColor={theme.mutedText} value={name}
        onChangeText={value => changeProtagonist(index, value)} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
    </View>)}
    <Pressable accessibilityRole="button" onPress={() => setProtagonists(current => [...current, ''])} style={styles.addName}>
      <Text style={[styles.addNameText, { color: theme.primary }]}>＋ 添加主角</Text>
    </Pressable>
    </View></GroupedSection>
    <GroupedSection title="阅读信息"><View style={styles.groupContent}>
    <Text style={[styles.label, { color: theme.text }]}>阅读状态</Text>
    <View style={styles.statusGroup}>
      {BOOK_STATUSES.map(choice => <Pressable key={choice} accessibilityRole="radio"
        accessibilityState={{ checked: status === choice }} onPress={() => changeStatus(choice)}
        style={[styles.statusOption, { borderColor: status === choice ? theme.primary : theme.border, backgroundColor: status === choice ? theme.primary : theme.card }]}>
        <Text style={{ color: status === choice ? theme.card : theme.text, fontWeight: status === choice ? '700' : '500' }}>{BOOK_STATUS_LABELS[choice]}</Text>
      </Pressable>)}
    </View>
    {status === 'want_to_read' || book.whyWantToRead ? <View>
      <Text style={[styles.label, { color: theme.text }]}>为什么想看</Text>
      <TextInput placeholder="为什么想看（可选）" placeholderTextColor={theme.mutedText} value={whyWantToRead} onChangeText={setWhyWantToRead}
        style={[styles.input, styles.multiline, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} multiline textAlignVertical="top" />
    </View> : null}
    {changingStatus && status !== 'want_to_read' ? <View style={styles.dateSection}>
      <Text style={[styles.datePreview, { color: theme.primary }]}>将记录第 {previewOrdinal} 次阅读{book.status === 'reading' && activeSession ? '的结束' : ''}</Text>
      <ReadingDateFields startedOn={startedOn} endedOn={endedOn} showEnd={status !== 'reading'}
        onStartChange={setStartedOn} onEndChange={setEndedOn} />
    </View> : null}
    {book.status === 'reading' && status === 'want_to_read' && activeSession
      ? <Text style={styles.warning}>保存时会取消当前在读记录。</Text> : null}
    {(status === 'finished' || book.ratingHalfStars !== null) ? <RatingField
      value={effectiveRatingHalfStars}
      allowNewValue={status === 'finished'}
      onChange={value => { setRatingHalfStars(value); setRatingCleared(value === null); }}
    /> : null}
    </View></GroupedSection>
    <GroupedSection title="分类与标签"><View style={styles.groupContent}>
    <Text style={[styles.label, { color: theme.text }]}>作品类型</Text>
    <TypePicker value={bookType} onChange={setBookType} />
    <Text style={[styles.label, { color: theme.text }]}>快捷标签</Text>
    <TagPicker tags={quickTags} selectedIds={tagIds} onChange={setTagIds} />
    <Pressable accessibilityRole="button" onPress={() => setShowAllTags(true)} style={[styles.allTagsButton, { borderColor: theme.primary }]}><Text style={[styles.allTagsText, { color: theme.primary }]}>全部标签</Text></Pressable>
    </View></GroupedSection>
    {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.save, { backgroundColor: theme.primary }]}>
      <Text style={styles.saveText}>{saving ? '保存中…' : '保存修改'}</Text>
    </Pressable>
    <BottomSheet visible={showAllTags} title="全部标签" onClose={() => setShowAllTags(false)}>
      <TagPicker tags={[...allTags, ...pendingTags]} selectedIds={tagIds} onChange={setTagIds} searchable onCreateTag={createPendingTag} />
    </BottomSheet>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: UI_LAYOUT.pageInset, gap: UI_LAYOUT.sectionGap, paddingBottom: 120 },
  groupContent: { padding: 16, gap: 10 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25', marginTop: 8 },
  input: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: '#fff' },
  multiline: { minHeight: 84 },
  statusGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  statusSelected: { backgroundColor: '#28584E', borderColor: '#28584E' },
  statusText: { color: '#302a25' },
  statusSelectedText: { color: '#fff', fontWeight: '700' },
  dateSection: { gap: 8 },
  datePreview: { color: '#28584E', fontWeight: '600' },
  warning: { color: '#a33b26' },
  nameRow: { gap: 6 },
  nameLabel: { color: '#766f68' },
  addName: { padding: 12, alignSelf: 'flex-start' },
  addNameText: { color: '#28584E', fontWeight: '600' },
  allTagsButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }, allTagsText: { fontWeight: '700' },
  error: { color: '#b52626' },
  save: { backgroundColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
