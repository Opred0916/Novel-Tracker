import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BOOK_STATUS_LABELS } from '../../books/status';
import type { LibraryOverview } from '../../books/libraryOverviewRepository';
import { useLibraryOverviewRepository } from '../../storage/AppProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { TabPageHeader } from '../../ui/TabPageHeader';
import { GroupedSection } from '../../ui/GroupedSection';
import { ActionRow } from '../../ui/ActionRow';
import { UI_LAYOUT } from '../../ui/layout';

export default function LibraryOverviewPage({ asTab = false }: { asTab?: boolean }) {
  const { theme } = useTheme();
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
    {asTab ? <TabPageHeader title="回顾" subtitle="沿着阅读记录，回看这一年的故事" /> : null}
    <View style={styles.body}>
    {!asTab ? <Text style={[styles.heading, { color: theme.text }]}>书库概览</Text> : null}
    <Text style={[styles.help, { color: theme.mutedText }]}>只读统计，不会改变书架数据；“今年读完”只统计有明确结束日期的读完记录，同一本书多次读完只算一次。</Text>
    {error ? <View style={styles.errorRow}><Text style={[styles.error, { color: theme.danger }]}>{error}</Text><Pressable accessibilityRole="button" onPress={refresh}><Text style={[styles.link, { color: theme.primary }]}>重试</Text></Pressable></View> : null}
    {!overview && !error ? <ActivityIndicator accessibilityLabel="正在读取概览" color={theme.primary} /> : null}
    {overview ? <><View style={[styles.highlight, { backgroundColor: theme.primarySoft }]}><Text style={[styles.highlightTitle, { color: theme.primary }]}>今年读完 {overview.finishedBooksThisYear} 本</Text><Text style={[styles.muted, { color: theme.mutedText }]}>{overview.year} 年 · 按不同书籍去重</Text></View><View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.cardTitle, { color: theme.text }]}>当前书架</Text><Text style={[styles.total, { color: theme.mutedText }]}>共 {overview.totalBooks} 本</Text>{(Object.keys(BOOK_STATUS_LABELS) as (keyof typeof BOOK_STATUS_LABELS)[]).map(status => <View key={status} style={styles.statusRow}><Text style={[styles.statusLabel, { color: theme.text }]}>{BOOK_STATUS_LABELS[status]}：{overview.byStatus[status]}</Text></View>)}</View></> : null}
    <GroupedSection title="继续回顾">
      <ActionRow label={`查看 ${year} 年度总结`} detail="把这一年的阅读整理成故事" onPress={() => router.push('/settings/annual-summary' as Href)} />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <ActionRow label="年度阅读回顾" detail="按年份查看读完记录与想法" onPress={() => router.push('/settings/annual-recap')} />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <ActionRow label="主题回顾卡片" detail="二刷、五星书和弃读书" onPress={() => router.push({ pathname: '/settings/themed-recap', params: { year: String(year) } })} />
    </GroupedSection>
    {!asTab ? <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.secondary, { borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>返回书架</Text></Pressable> : null}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 50 }, body: { paddingHorizontal: UI_LAYOUT.pageInset, gap: UI_LAYOUT.sectionGap }, heading: { fontSize: 26, fontWeight: '700', color: '#302a25', marginTop: 16 }, help: { color: '#766f68', lineHeight: 21 }, errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, error: { color: '#b52626' }, link: { color: '#28584E', fontWeight: '700' }, highlight: { borderRadius: 16, padding: 20, gap: 8 }, highlightTitle: { fontSize: 22, fontWeight: '700' }, muted: { color: '#fff' }, card: { backgroundColor: '#fff', borderRadius: 14, padding: 18, gap: 12, borderWidth: 1, borderColor: '#e1dad1' }, cardTitle: { fontSize: 18, fontWeight: '700', color: '#302a25' }, total: { color: '#817871' }, statusRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#eee7df', paddingTop: 10 }, statusLabel: { color: '#302a25' }, divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 }, secondary: { borderWidth: 1, borderColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center' }, secondaryText: { color: '#28584E', fontWeight: '700' },
});
