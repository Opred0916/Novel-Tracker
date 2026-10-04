import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ImportSummary } from './importReview';

export function ImportCompletionView({ summary, onBookshelf, onAnnualRecap }: { summary: ImportSummary; onBookshelf(): void; onAnnualRecap(): void }) {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: theme.background }]}>
    <View style={styles.hero}><Text style={[styles.emoji, { color: theme.primary }]}>✓</Text><Text style={[styles.title, { color: theme.text }]}>导入完成</Text><Text style={[styles.subtitle, { color: theme.mutedText }]}>旧记录已经安全写入书库。</Text></View>
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.cardTitle, { color: theme.text }]}>本次导入</Text>
      <View style={styles.grid}>
        <Stat label="新增小说" value={`${summary.createdBooks} 本`} theme={theme} />
        <Stat label="新增想法" value={`${summary.createdNotes} 条`} theme={theme} />
        <Stat label="新增阅读记录" value={`${summary.createdSessions} 条`} theme={theme} />
        <Stat label="追加到已有书目" value={`${summary.appendedBookCount} 本`} theme={theme} />
        <Stat label="重读记录" value={`${summary.rereadSessions} 条`} theme={theme} />
        <Stat label="五星小说" value={`${summary.fiveStarBooks} 本`} theme={theme} />
        <Stat label="跳过项" value={`${summary.skippedItems} 条`} theme={theme} />
      </View>
      <Text style={[styles.earliest, { color: theme.mutedText }]}>最早记录日期：{summary.earliestRecordedOn ?? '日期未记录'}</Text>
    </View>
    <View style={styles.actions}><Pressable accessibilityRole="button" onPress={onBookshelf} style={[styles.primary, { backgroundColor: theme.primary }]}><Text style={styles.primaryText}>打开书库</Text></Pressable><Pressable accessibilityRole="button" onPress={onAnnualRecap} style={[styles.secondary, { borderColor: theme.border }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>查看年度回顾</Text></Pressable></View>
  </ScrollView>;
}

function Stat({ label, value, theme }: { label: string; value: string; theme: { text: string; mutedText: string } }) {
  return <View style={styles.stat}><Text style={[styles.statValue, { color: theme.text }]}>{label} {value}</Text><Text style={[styles.statLabel, { color: theme.mutedText }]}>{label === '新增小说' ? '已经可以在书架中继续整理' : label === '重读记录' ? '会参与年度回顾' : ''}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, gap: 18 }, hero: { alignItems: 'center', paddingTop: 24, gap: 8 }, emoji: { fontSize: 48, fontWeight: '800' }, title: { fontSize: 30, fontWeight: '800' }, subtitle: { fontSize: 15 }, card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 }, cardTitle: { fontSize: 19, fontWeight: '800' }, grid: { gap: 12 }, stat: { gap: 3 }, statValue: { fontSize: 16, fontWeight: '700' }, statLabel: { minHeight: 17, fontSize: 12 }, earliest: { marginTop: 3, fontSize: 13 }, actions: { gap: 10 }, primary: { alignItems: 'center', borderRadius: 14, padding: 15 }, primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 }, secondary: { alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 15 },
});
