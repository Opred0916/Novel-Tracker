import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AnnualStorySummary } from '../../books/annualSummaryRepository';
import { useAnnualSummaryRepository } from '../../storage/AppProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { ActionRow } from '../../ui/ActionRow';
import { GroupedSection } from '../../ui/GroupedSection';
import { TabPageHeader } from '../../ui/TabPageHeader';
import { UI_LAYOUT } from '../../ui/layout';

export default function RecapTab() {
  const { theme } = useTheme();
  const repository = useAnnualSummaryRepository();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [years, setYears] = useState<number[]>([]);
  const [summary, setSummary] = useState<AnnualStorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  const refresh = useCallback(() => {
    let active = true;
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    setSummary(null);
    void repository.availableYears(new Date().getFullYear()).then(value => {
      if (active && requestVersion.current === version) setYears(value);
    }).catch(() => undefined);
    void repository.getYear(year).then(value => {
      if (!active || requestVersion.current !== version) return;
      setSummary(value);
      setLoading(false);
    }).catch(() => {
      if (!active || requestVersion.current !== version) return;
      setError('读取年度回顾失败，请重试');
      setLoading(false);
    });
    return () => { active = false; };
  }, [repository, year]);
  useFocusEffect(refresh);

  return <ScrollView contentContainerStyle={styles.page}>
    <TabPageHeader title="回顾" subtitle="沿着阅读记录，回看这一年的故事" />
    <View style={styles.body}>
      <Text style={[styles.heading, { color: theme.text }]}>{year} 年阅读回顾</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
        {(years.length ? years : [year]).map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: option === year }} onPress={() => setYear(option)} style={[styles.year, { borderColor: option === year ? theme.primary : theme.border, backgroundColor: option === year ? theme.primarySoft : theme.card }]}><Text style={[styles.yearText, { color: option === year ? theme.primary : theme.text }]}>{option}</Text></Pressable>)}
      </ScrollView>
      {loading ? <ActivityIndicator accessibilityLabel="正在读取年度回顾" color={theme.primary} /> : null}
      {error ? <View style={styles.errorRow}><Text style={{ color: theme.danger }}>{error}</Text><Pressable accessibilityRole="button" onPress={refresh}><Text style={[styles.retry, { color: theme.primary }]}>重试</Text></Pressable></View> : null}
      {summary ? <>
        {summary.booksReadCount ? <View style={[styles.stats, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.mainStat, { color: theme.primary }]}>读完 {summary.booksReadCount} 本</Text>
          <Text style={[styles.stat, { color: theme.text }]}>留下 {summary.thoughtCount} 条想法</Text>
          <Text style={[styles.stat, { color: theme.text }]}>五星书 {summary.fiveStarBookCount} 本</Text>
        </View> : <Text style={[styles.empty, { color: theme.mutedText }]}>这一年还没有读完记录</Text>}
        <GroupedSection title="继续回顾">
          <ActionRow label="年度总结" detail="浏览这一年的阅读故事与分享内容" onPress={() => router.push({ pathname: '/settings/annual-summary', params: { year: String(year) } })} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <ActionRow label="阅读记录" detail="查看这一年读过的书、日期和想法" onPress={() => router.push({ pathname: '/settings/annual-recap', params: { year: String(year) } })} />
        </GroupedSection>
      </> : null}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingBottom: 50 },
  body: { paddingHorizontal: UI_LAYOUT.pageInset, gap: UI_LAYOUT.sectionGap },
  heading: { fontSize: 26, fontWeight: '700', marginTop: 12 },
  years: { gap: 8 },
  year: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 9 },
  yearText: { fontWeight: '700' },
  stats: { borderRadius: UI_LAYOUT.groupRadius, padding: 22, gap: 12 },
  mainStat: { fontSize: 28, fontWeight: '800' },
  stat: { fontSize: 17, fontWeight: '600' },
  empty: { paddingVertical: 24, textAlign: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  retry: { fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
