import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BOOK_STATUS_LABELS } from '../books/status';
import { BOOK_STATUSES, type BookStatus } from '../books/types';
import type { ImportMode } from './importTypes';
import { useTheme } from '../theme/ThemeProvider';
import { GroupedSection } from '../ui/GroupedSection';
import { UI_LAYOUT } from '../ui/layout';

export function ImportSourceForm({ text, mode, defaultStatus, error, onTextChange, onModeChange, onStatusChange, onPickFile, onPickScreenshots, onPickTable, tableDelimiter, onTableDelimiterChange, onParse, onManualCandidate }: {
  text: string; mode: ImportMode; defaultStatus: BookStatus; error: string;
  onTextChange: (value: string) => void; onModeChange: (value: ImportMode) => void; onStatusChange: (value: BookStatus) => void;
  onPickFile: () => void; onPickScreenshots?: () => void; onPickTable?: () => void; tableDelimiter?: ',' | ';' | '\t'; onTableDelimiterChange?: (value: ',' | ';' | '\t') => void;
  onParse: () => void; onManualCandidate: () => void;
}) {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text style={[styles.heading, { color: theme.text }]}>追加旧记录</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>先粘贴文字或选择 UTF-8 TXT，解析后会进入预览；确认前不会写入书架。微博链接不会自动抓取；截图可在本机手工校对。</Text>
    <GroupedSection title="选择来源"><View style={styles.groupContent}>
    <TextInput accessibilityLabel="要导入的文字" multiline value={text} onChangeText={onTextChange} placeholder="粘贴旧书单或摘记文字" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} textAlignVertical="top" />
    <Pressable accessibilityRole="button" onPress={onPickFile} style={[styles.secondary, { backgroundColor: theme.card, borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>选择 TXT 文件</Text></Pressable>
    {onPickScreenshots ? <Pressable accessibilityRole="button" onPress={onPickScreenshots} style={[styles.secondary, { backgroundColor: theme.card, borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>从截图导入</Text></Pressable> : null}
    {onPickTable ? <Pressable accessibilityRole="button" onPress={onPickTable} style={[styles.secondary, { backgroundColor: theme.card, borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>选择 CSV / XLSX 文件</Text></Pressable> : null}
    </View></GroupedSection>
    <GroupedSection title="解析设置"><View style={styles.groupContent}>
    <Text style={[styles.label, { color: theme.text }]}>记录格式</Text>
    <View style={styles.row}>{([['lines', '每行一本书'], ['blocks', '字段段落'], ['numbered_replies', '编号＋回复']] as const).map(([value, label]) => { const selected = mode === value; return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onModeChange(value)} style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.border }]}><Text style={{ color: selected ? theme.card : theme.text, fontWeight: selected ? '700' : '500' }}>{label}</Text></Pressable>; })}</View>
    <Text style={[styles.label, { color: theme.text }]}>未填写状态时默认</Text>
    <View style={styles.row}>{BOOK_STATUSES.map(value => { const selected = defaultStatus === value; return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onStatusChange(value)} style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.border }]}><Text style={{ color: selected ? theme.card : theme.text, fontWeight: selected ? '700' : '500' }}>{BOOK_STATUS_LABELS[value]}</Text></Pressable>; })}</View>
    {onPickTable ? <><Text style={[styles.label, { color: theme.text }]}>表格分隔符（CSV）</Text><View style={styles.row}>{([[';', '分号'], [',', '逗号'], ['\t', '制表符']] as const).map(([value, label]) => { const selected = tableDelimiter === value; return <Pressable key={label} onPress={() => onTableDelimiterChange?.(value)} style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.border }]}><Text style={{ color: selected ? theme.card : theme.text, fontWeight: selected ? '700' : '500' }}>{label}</Text></Pressable>; })}</View></> : null}
    </View></GroupedSection>
    {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <Pressable accessibilityRole="button" onPress={onParse} style={[styles.primary, { backgroundColor: theme.primary }]}><Text style={styles.primaryText}>生成导入预览</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onManualCandidate} style={styles.link}><Text style={[styles.linkText, { color: theme.primary }]}>没有可解析文字？手动添加一条</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: UI_LAYOUT.pageInset, gap: UI_LAYOUT.sectionGap, paddingBottom: 80 }, groupContent: { padding: 16, gap: 10 }, heading: { fontSize: 25, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 }, label: { fontWeight: '700', color: '#302a25' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#d6cec4', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }, selected: { backgroundColor: '#28584E', borderColor: '#28584E' }, chipText: { color: '#302a25' }, selectedText: { color: '#fff', fontWeight: '700' }, input: { minHeight: 160, borderWidth: 1, borderColor: '#d6cec4', borderRadius: 12, backgroundColor: '#fff', padding: 14, fontSize: 16 }, error: { color: '#b52626', lineHeight: 20 }, primary: { backgroundColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#28584E', padding: 14, borderRadius: 12, alignItems: 'center' }, secondaryText: { color: '#28584E', fontWeight: '700' }, link: { alignItems: 'center', padding: 10 }, linkText: { color: '#28584E', fontWeight: '600' },
});
