import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BOOK_STATUS_LABELS } from '../books/status';
import type { BookStatus } from '../books/types';
import { mapTableToImport, suggestTableMapping, TABLE_FIELD_LABELS, TABLE_FIELD_ORDER, validateTableMapping } from './tableImportMapping';
import type { ImportParseResult } from './importTypes';
import type { TableColumnMapping, TableField, TableMappingOptions, TableSheet } from './tableImportTypes';
import { useTheme } from '../theme/ThemeProvider';

type Props = { sheet: TableSheet; defaultStatus: BookStatus; tagIdsByName: ReadonlyMap<string, string>; onMapped: (result: ImportParseResult) => void; onBack: () => void };

function copySheet(sheet: TableSheet): TableSheet { return { ...sheet, rows: sheet.rows.map(row => row.map(cell => ({ ...cell }))) }; }
function columnLabel(sheet: TableSheet, column: number, hasHeader: boolean): string { return hasHeader ? sheet.rows[0]?.[column]?.text.trim() || `第 ${column + 1} 列` : `第 ${column + 1} 列`; }
function mappedField(mapping: TableColumnMapping, column: number): TableField | undefined { return TABLE_FIELD_ORDER.find(field => mapping[field] === column); }

export function TableImportMapping({ sheet: originalSheet, defaultStatus, tagIdsByName, onMapped, onBack }: Props) {
  const { theme } = useTheme();
  const [sheet, setSheet] = useState(() => copySheet(originalSheet));
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<TableColumnMapping>(() => suggestTableMapping(originalSheet));
  const [ignoredColumns, setIgnoredColumns] = useState<number[]>([]);
  const [skippedRows, setSkippedRows] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const maxColumns = Math.max(...sheet.rows.map(row => row.length), 0);
  const unassignedColumns = useMemo(() => Array.from({ length: maxColumns }, (_, column) => column).filter(column => !mappedField(mapping, column) && !ignoredColumns.includes(column)), [ignoredColumns, mapping, maxColumns]);
  const options: TableMappingOptions = { hasHeader, defaultStatus, ignoredColumns, skippedRows, protagonistDelimiter: '、', tagDelimiter: '、', tagIdsByName };

  function cycleColumn(column: number) {
    const current = mappedField(mapping, column);
    const available = [undefined, ...TABLE_FIELD_ORDER.filter(field => field === current || mapping[field] === undefined)];
    const next = available[(available.indexOf(current) + 1) % available.length];
    const nextMapping = { ...mapping };
    for (const field of TABLE_FIELD_ORDER) if (nextMapping[field] === column) delete nextMapping[field];
    if (next) nextMapping[next] = column;
    setMapping(nextMapping); setIgnoredColumns(columns => columns.filter(value => value !== column)); setIssues([]); setError('');
  }
  function updateCell(row: number, column: number, text: string) {
    setSheet(current => ({ ...current, rows: current.rows.map((values, rowIndex) => rowIndex === row ? values.map((cell, columnIndex) => columnIndex === column ? { ...cell, text } : cell) : values) }));
    setIssues([]); setError('');
  }
  function skipRow(rowNumber: number) { setSkippedRows(rows => [...new Set([...rows, rowNumber])]); setIssues([]); setError(''); }
  function confirm(ignoreUnassigned: boolean) {
    const nextIgnored = ignoreUnassigned ? [...new Set([...ignoredColumns, ...unassignedColumns])] : ignoredColumns;
    if (ignoreUnassigned) setIgnoredColumns(nextIgnored);
    const nextOptions = { ...options, ignoredColumns: nextIgnored };
    const nextIssues = validateTableMapping(sheet, mapping, nextOptions);
    setIssues(nextIssues.map(item => `第 ${item.rowNumber || 1} 行：${item.message}`));
    if (nextIssues.length) { setError('请先修正问题，或明确跳过对应行。'); return; }
    try { onMapped(mapTableToImport(sheet, mapping, nextOptions)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '表格无法生成导入预览'); }
  }
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={[styles.heading, { color: theme.text }]}>表格列对应</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>点击每列的对应按钮循环选择字段。书名必须对应；没有用途的列必须明确忽略。前五行可直接修正文字。</Text>
    <View style={styles.row}><Pressable onPress={() => { setHasHeader(value => { const next = !value; setMapping(next ? suggestTableMapping(sheet) : {}); setIgnoredColumns([]); return next; }); setIssues([]); setError(''); }} style={[styles.chip, { backgroundColor: hasHeader ? theme.primary : theme.card, borderColor: hasHeader ? theme.primary : theme.border }]}><Text style={{ color: hasHeader ? theme.card : theme.text, fontWeight: hasHeader ? '700' : '500' }}>{hasHeader ? '首行为表头' : '无表头'}</Text></Pressable><View style={styles.status}><Text style={[styles.statusLabel, { color: theme.mutedText }]}>默认状态</Text><Text style={[styles.statusValue, { color: theme.text }]}>{BOOK_STATUS_LABELS[defaultStatus]}</Text></View></View>
    <View style={styles.mappingList}>{Array.from({ length: maxColumns }, (_, column) => { const selected = mappedField(mapping, column); return <View key={column} style={[styles.mappingRow, { backgroundColor: theme.card }]}><Text style={[styles.columnName, { color: theme.text }]}>{columnLabel(sheet, column, hasHeader)}</Text><Pressable accessibilityLabel={`第${column + 1}列映射`} onPress={() => cycleColumn(column)} style={[styles.mappingButton, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : theme.card }]}><Text style={{ color: selected ? theme.card : theme.text, fontWeight: selected ? '700' : '500' }}>{selected ? TABLE_FIELD_LABELS[selected] : '忽略'}</Text></Pressable></View>; })}</View>
    <Text style={[styles.previewHeading, { color: theme.text }]}>表格预览</Text>
    <View style={styles.preview}>{sheet.rows.slice(0, 5).map((row, rowIndex) => <View key={rowIndex} style={styles.previewRow}><Text style={[styles.rowNumber, { color: theme.mutedText }]}>第 {rowIndex + 1} 行</Text><View style={styles.previewCells}>{row.map((cell, column) => <TextInput key={`${rowIndex}-${column}`} value={cell.text} onChangeText={text => updateCell(rowIndex, column, text)} placeholderTextColor={theme.mutedText} style={[styles.cell, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} accessibilityLabel={`第${rowIndex + 1}行第${column + 1}列`} />)}</View></View>)}</View>
    {issues.map((item, index) => <View key={`${item}-${index}`} style={styles.issue}><Text style={[styles.error, { color: theme.danger }]}>{item}</Text>{/^第 \d+ 行/.test(item) && Number(item.match(/^第 (\d+)/)?.[1]) > (hasHeader ? 1 : 0) ? <Pressable onPress={() => skipRow(Number(item.match(/^第 (\d+)/)?.[1]))}><Text style={[styles.linkText, { color: theme.primary }]}>跳过这一行</Text></Pressable> : null}</View>)}
    {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <View style={styles.footer}><Pressable accessibilityRole="button" onPress={() => confirm(true)} style={[styles.primary, { backgroundColor: theme.primary }]}><Text style={styles.primaryText}>{unassignedColumns.length ? '忽略未对应列并生成预览' : '生成表格导入预览'}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => confirm(false)} style={[styles.secondary, { borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>只验证当前对应关系</Text></Pressable><Pressable accessibilityRole="button" onPress={onBack} style={styles.link}><Text style={[styles.linkText, { color: theme.primary }]}>返回上一步</Text></Pressable></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 22, gap: 14, paddingBottom: 50 }, heading: { fontSize: 25, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, chip: { borderWidth: 1, borderColor: '#d6cec4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }, selected: { backgroundColor: '#28584E', borderColor: '#28584E' }, chipText: { color: '#302a25' }, selectedText: { color: '#fff', fontWeight: '700' }, status: { gap: 2 }, statusLabel: { color: '#817871', fontSize: 12 }, statusValue: { color: '#302a25', fontWeight: '600' }, mappingList: { gap: 8 }, mappingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#fff', borderRadius: 10, padding: 10 }, columnName: { flex: 1, color: '#302a25' }, mappingButton: { minWidth: 90, borderWidth: 1, borderColor: '#d6cec4', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' }, mappingText: { color: '#302a25' }, previewHeading: { fontWeight: '700', color: '#302a25', marginTop: 4 }, preview: { gap: 8 }, previewRow: { backgroundColor: '#faf7f2', borderRadius: 10, padding: 8, gap: 5 }, rowNumber: { color: '#817871', fontSize: 12 }, previewCells: { gap: 6 }, cell: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6cec4', borderRadius: 8, padding: 8, color: '#302a25' }, issue: { backgroundColor: '#fff7e9', borderRadius: 10, padding: 10, gap: 6 }, error: { color: '#b52626', lineHeight: 20 }, footer: { gap: 10, paddingTop: 6 }, primary: { backgroundColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, secondary: { borderWidth: 1, borderColor: '#28584E', padding: 15, borderRadius: 12, alignItems: 'center' }, secondaryText: { color: '#28584E', fontWeight: '700' }, link: { alignItems: 'center', padding: 10 }, linkText: { color: '#28584E', fontWeight: '600' },
});
