import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useContext, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AnnualStoryPager } from '../../books/AnnualStoryPager';
import type { AnnualStorySummary } from '../../books/annualSummaryRepository';
import { buildAnnualStoryPages } from '../../books/annualStoryPages';
import { useAnnualSummaryRepository } from '../../storage/AppProvider';
import { useTheme } from '../../theme/ThemeProvider';

export default function AnnualSummaryPage() {
  const { theme } = useTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const repository = useAnnualSummaryRepository();
  const currentYear = new Date().getFullYear();
  const params = useLocalSearchParams<{ year?: string | string[] }>();
  const requestedYear = typeof params.year === 'string' && /^\d{4}$/.test(params.year) && Number(params.year) > 0 ? Number(params.year) : currentYear;
  const [year, setYear] = useState(requestedYear);
  const [years, setYears] = useState<number[]>([]);
  const [summary, setSummary] = useState<AnnualStorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  const refresh = useCallback(() => {
    let active = true;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setLoading(true);
    setError('');
    setSummary(null);
    void repository.availableYears(currentYear).then(value => {
      if (active && requestVersion.current === version) setYears(value);
    }).catch(() => undefined);
    void repository.getYear(year).then(value => {
      if (!active || requestVersion.current !== version) return;
      setSummary(value);
      setLoading(false);
    }).catch(() => {
      if (!active || requestVersion.current !== version) return;
      setLoading(false);
      setError('读取年度总结失败，请重试');
    });
    return () => { active = false; };
  }, [currentYear, repository, year]);
  useFocusEffect(refresh);

  const pages = summary ? buildAnnualStoryPages(summary) : [];

  return <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="返回回顾" onPress={() => router.back()} style={styles.backButton}><Text style={[styles.backChevron, { color: theme.primary }]}>‹</Text></Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRow}>
        {(years.length ? years : [year]).map(option => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`查看 ${option} 年`} accessibilityState={{ selected: option === year }} onPress={() => setYear(option)} style={[styles.yearButton, { borderColor: option === year ? theme.primary : theme.border, backgroundColor: option === year ? theme.primarySoft : theme.card }]}><Text style={[styles.yearText, { color: option === year ? theme.primary : theme.mutedText }]}>{option}</Text></Pressable>)}
      </ScrollView>
    </View>
    {loading ? <View style={styles.center}><ActivityIndicator accessibilityLabel="正在生成年度总结" color={theme.primary} /><Text style={[styles.muted, { color: theme.mutedText }]}>正在整理这一年的故事…</Text></View> : null}
    {error ? <View style={styles.center}><Text style={[styles.error, { color: theme.danger }]}>{error}</Text><Pressable accessibilityRole="button" onPress={refresh} style={[styles.action, { backgroundColor: theme.primary }]}><Text style={styles.actionText}>重试</Text></Pressable></View> : null}
    {!loading && !error && summary && pages.length ? <AnnualStoryPager key={summary.year} summary={summary} pages={pages} onOpenBook={bookId => router.push({ pathname: '/book/[id]', params: { id: bookId } })} /> : null}
    {!loading && !error && summary && pages.length === 0 ? <View style={styles.center}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>这一年还没有带完成日期的读完记录</Text>
      <Text style={[styles.muted, { color: theme.mutedText }]}>可以到书架打开小说，补充读完日期；没有可靠日期时不会推测。</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/')} style={[styles.action, { backgroundColor: theme.primary }]}><Text style={styles.actionText}>去书架补充日期</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/settings/annual-recap', params: { year: String(year) } })} style={[styles.secondary, { borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>查看阅读记录</Text></Pressable>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backChevron: { fontSize: 38, lineHeight: 42, fontWeight: '300' },
  yearRow: { gap: 8, alignItems: 'center' },
  yearButton: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 8 },
  yearText: { fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 16 },
  emptyTitle: { fontSize: 23, lineHeight: 32, textAlign: 'center', fontWeight: '800' },
  muted: { fontSize: 15, lineHeight: 23, textAlign: 'center' },
  error: { fontSize: 16, textAlign: 'center' },
  action: { minWidth: 180, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  actionText: { color: '#FFFFFF', fontWeight: '800' },
  secondary: { minWidth: 180, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  secondaryText: { fontWeight: '800' },
});
