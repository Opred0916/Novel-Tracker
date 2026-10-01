import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RatingField } from './RatingField';
import { BOOK_STATUS_LABELS } from './status';
import { BOOK_STATUSES, type BookInput, type BookStatus } from './types';
import { normalizeBookCreate } from './validation';

export function AddBookForm({ onSave }: { onSave: (input: BookInput) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<BookStatus>('want_to_read');
  const [protagonists, setProtagonists] = useState(['', '']);
  const [ratingHalfStars, setRatingHalfStars] = useState<number | null>(null);
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
        title, author, status, protagonists,
        ratingHalfStars: status === 'finished' ? ratingHalfStars : null,
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

  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.label}>书名 *</Text>
    <TextInput placeholder="输入小说书名" value={title} onChangeText={setTitle} style={styles.input} autoFocus />
    <Text style={styles.help}>只填书名也能保存，其他资料可以现在填写或以后补充。</Text>
    <Text style={styles.label}>作者</Text>
    <TextInput placeholder="作者名字" value={author} onChangeText={setAuthor} style={styles.input} />
    <Text style={styles.label}>阅读状态</Text>
    <View style={styles.statusGroup}>
      {BOOK_STATUSES.map(choice => <Pressable key={choice} accessibilityRole="radio"
        accessibilityState={{ checked: status === choice }} onPress={() => setStatus(choice)}
        style={[styles.statusOption, status === choice && styles.statusSelected]}>
        <Text style={[styles.statusText, status === choice && styles.statusSelectedText]}>{BOOK_STATUS_LABELS[choice]}</Text>
      </Pressable>)}
    </View>
    <Text style={styles.label}>主角名字</Text>
    {protagonists.map((name, index) => <View key={index} style={styles.nameRow}>
      <Text style={styles.nameLabel}>主角 {index + 1}</Text>
      <TextInput accessibilityLabel={`主角 ${index + 1}`} placeholder="主角名字" value={name}
        onChangeText={value => changeProtagonist(index, value)} style={styles.input} />
    </View>)}
    <Pressable accessibilityRole="button" onPress={() => setProtagonists(current => [...current, ''])} style={styles.addName}>
      <Text style={styles.addNameText}>＋ 添加主角</Text>
    </Pressable>
    {status === 'finished' ? <RatingField value={ratingHalfStars} onChange={setRatingHalfStars} allowNewValue /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.button}>
      <Text style={styles.buttonText}>{saving ? '保存中…' : '保存小说'}</Text>
    </Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, paddingBottom: 50 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25', marginTop: 8 },
  input: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: '#fff' },
  help: { color: '#766f68', fontSize: 13 },
  statusGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  statusSelected: { backgroundColor: '#593f72', borderColor: '#593f72' },
  statusText: { color: '#302a25' },
  statusSelectedText: { color: '#fff', fontWeight: '700' },
  nameRow: { gap: 6 },
  nameLabel: { color: '#766f68' },
  addName: { padding: 12, alignSelf: 'flex-start' },
  addNameText: { color: '#593f72', fontWeight: '600' },
  error: { color: '#b52626' },
  button: { backgroundColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
