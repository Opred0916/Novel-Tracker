import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BOOK_STATUS_LABELS } from '../../books/status';
import type { LibraryOverview } from '../../books/libraryOverviewRepository';
import { useLibraryOverviewRepository } from '../../storage/AppProvider';

export default function LibraryOverviewPage() {
  const repository = useLibraryOverviewRepository();
  const [overview, setOverview] = useState<LibraryOverview | null>(null);
  const [error, setError] = useState('');
  const year = new Date().getFullYear();

  const refresh = useCallback(() => {
    setError('');
    void repository.getOverview(year).then(setOverview).catch(() => setError('读取概览失败，请重试'));
  }, [repository, year]);
  useFocusEffect(refresh);

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.heading}>书库概览</Text>
    <Text style={styles.help}>只读统计，不会改变书架数据；“今年读完”只统计有明确结束日期的读完记录，同一本书多次读完只算一次。</Text>
    {error ? <View style={styles.errorRow}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={refresh}><Text style={styles.link}>重试</Text></Pressable></View> : null}
    {!overview && !error ? <ActivityIndicator accessibilityLabel="正在读取概览" color="#593f72" /> : null}
    {overview ? <><View style={styles.highlight}><Text style={styles.highlightTitle}>今年读完 {overview.finishedBooksThisYear} 本</Text><Text style={styles.muted}>{overview.year} 年 · 按不同书籍去重</Text></View><View style={styles.card}><Text style={styles.cardTitle}>当前书架</Text><Text style={styles.total}>共 {overview.totalBooks} 本</Text>{(Object.keys(BOOK_STATUS_LABELS) as (keyof typeof BOOK_STATUS_LABELS)[]).map(status => <View key={status} style={styles.statusRow}><Text style={styles.statusLabel}>{BOOK_STATUS_LABELS[status]}：{overview.byStatus[status]}</Text></View>)}</View></> : null}
    <Pressable accessibilityRole="button" onPress={() => router.push('/settings/annual-recap')} style={styles.secondary}><Text style={styles.secondaryText}>年度阅读回顾</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>返回书架</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, paddingBottom: 50 }, heading: { fontSize: 26, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 21 }, errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, error: { color: '#b52626' }, link: { color: '#593f72', fontWeight: '700' }, highlight: { backgroundColor: '#593f72', borderRadius: 16, padding: 20, gap: 8 }, highlightTitle: { color: '#fff', fontSize: 22, fontWeight: '700' }, muted: { color: '#eee6f3' }, card: { backgroundColor: '#fff', borderRadius: 14, padding: 18, gap: 12, borderWidth: 1, borderColor: '#e1dad1' }, cardTitle: { fontSize: 18, fontWeight: '700', color: '#302a25' }, total: { color: '#817871' }, statusRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#eee7df', paddingTop: 10 }, statusLabel: { color: '#302a25' }, statusCount: { color: '#593f72', fontWeight: '700' }, secondary: { borderWidth: 1, borderColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' }, secondaryText: { color: '#593f72', fontWeight: '700' },
});
