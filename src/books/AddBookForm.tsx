import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BookInput } from './types';

export function AddBookForm({ onSave }: { onSave: (input: BookInput) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed) { setError('请输入书名'); return; }
    setSaving(true);
    setError('');
    try { await onSave({ title: trimmed, status: 'want_to_read' }); }
    catch { setError('保存失败，请重试'); }
    finally { setSaving(false); }
  }

  return <View style={styles.container}>
    <Text style={styles.label}>书名 *</Text>
    <TextInput placeholder="输入小说书名" value={title} onChangeText={setTitle} style={styles.input} autoFocus />
    <Text style={styles.help}>先记下书名，其他信息以后可以慢慢补。</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.button}>
      <Text style={styles.buttonText}>{saving ? '保存中…' : '保存到想读'}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25' },
  input: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: '#fff' },
  help: { color: '#766f68', fontSize: 13 },
  error: { color: '#b52626' },
  button: { backgroundColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
