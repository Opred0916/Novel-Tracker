import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BOOK_STATUS_LABELS } from '../books/status';
import { BOOK_STATUSES, type BookStatus } from '../books/types';
import type { ImportMode } from './importTypes';

export function ImportSourceForm({ text, mode, defaultStatus, error, onTextChange, onModeChange, onStatusChange, onPickFile, onParse, onManualCandidate }: {
  text: string; mode: ImportMode; defaultStatus: BookStatus; error: string;
  onTextChange: (value: string) => void; onModeChange: (value: ImportMode) => void; onStatusChange: (value: BookStatus) => void;
  onPickFile: () => void; onParse: () => void; onManualCandidate: () => void;
}) {
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text style={styles.heading}>追加旧记录</Text>
    <Text style={styles.help}>先粘贴文字或选择 UTF-8 TXT，解析后会进入预览；确认前不会写入书架。微博链接和截图暂不自动抓取。</Text>
    <Text style={styles.label}>记录格式</Text>
    <View style={styles.row}>{([['lines', '每行一本书'], ['blocks', '字段段落'], ['numbered_replies', '编号＋回复']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value }} onPress={() => onModeChange(value)} style={[styles.chip, mode === value && styles.selected]}><Text style={[styles.chipText, mode === value && styles.selectedText]}>{label}</Text></Pressable>)}</View>
    <Text style={styles.label}>未填写状态时默认</Text>
    <View style={styles.row}>{BOOK_STATUSES.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: defaultStatus === value }} onPress={() => onStatusChange(value)} style={[styles.chip, defaultStatus === value && styles.selected]}><Text style={[styles.chipText, defaultStatus === value && styles.selectedText]}>{BOOK_STATUS_LABELS[value]}</Text></Pressable>)}</View>
    <TextInput accessibilityLabel="要导入的文字" multiline value={text} onChangeText={onTextChange} placeholder="粘贴旧书单或摘记文字" style={styles.input} textAlignVertical="top" />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" onPress={onPickFile} style={styles.secondary}><Text style={styles.secondaryText}>选择 TXT 文件</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onParse} style={styles.primary}><Text style={styles.primaryText}>生成导入预览</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onManualCandidate} style={styles.link}><Text style={styles.linkText}>没有可解析文字？手动添加一条</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14, paddingBottom: 50 }, heading: { fontSize: 25, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 }, label: { fontWeight: '700', color: '#302a25' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#d6cec4', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }, selected: { backgroundColor: '#593f72', borderColor: '#593f72' }, chipText: { color: '#302a25' }, selectedText: { color: '#fff', fontWeight: '700' }, input: { minHeight: 210, borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, backgroundColor: '#fff', padding: 14, fontSize: 16 }, error: { color: '#b52626', lineHeight: 20 }, primary: { backgroundColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' }, secondaryText: { color: '#593f72', fontWeight: '700' }, link: { alignItems: 'center', padding: 10 }, linkText: { color: '#593f72', fontWeight: '600' },
});
