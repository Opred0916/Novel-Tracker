import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { AnnualStorySummary } from './annualSummaryRepository';
import type { AnnualStoryPage } from './annualStoryPages';
import { AnnualStoryPageView } from './AnnualStoryPageView';

export function AnnualStoryPager({ summary, pages, onOpenBook }: {
  summary: AnnualStorySummary;
  pages: AnnualStoryPage[];
  onOpenBook(bookId: string): void;
}) {
  return <AnnualStoryPagerInner key={summary.year} summary={summary} pages={pages} onOpenBook={onOpenBook} />;
}

function AnnualStoryPagerInner({ summary, pages, onOpenBook }: {
  summary: AnnualStorySummary;
  pages: AnnualStoryPage[];
  onOpenBook(bookId: string): void;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<AnnualStoryPage>>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: index * width, animated: false });
  }, [index, width]);

  function goTo(nextIndex: number) {
    const safeIndex = Math.max(0, Math.min(pages.length - 1, nextIndex));
    setIndex(safeIndex);
    listRef.current?.scrollToOffset({ offset: safeIndex * width, animated: true });
  }

  return <View style={styles.container}>
    <FlatList
      testID="annual-story-list"
      ref={listRef}
      data={pages}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      keyExtractor={page => page.id}
      getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
      onMomentumScrollEnd={event => setIndex(Math.max(0, Math.min(pages.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
      renderItem={({ item }) => <AnnualStoryPageView page={item} summary={summary} width={width} onOpenBook={onOpenBook} />}
    />
    <View style={styles.navigation}>
      <Pressable accessibilityRole="button" accessibilityLabel="上一页" accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => goTo(index - 1)} style={styles.navButton}>
        <Text style={[styles.navText, { color: index === 0 ? theme.mutedText : theme.primary }]}>上一页</Text>
      </Pressable>
      <View style={styles.progress}>
        <Text style={[styles.progressText, { color: theme.text }]}>{index + 1} / {pages.length}</Text>
        <View style={styles.dots}>{pages.map((page, dotIndex) => <View key={page.id} style={[styles.dot, { backgroundColor: dotIndex === index ? theme.primary : theme.border }]} />)}</View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="下一页" accessibilityState={{ disabled: index === pages.length - 1 }} disabled={index === pages.length - 1} onPress={() => goTo(index + 1)} style={styles.navButton}>
        <Text style={[styles.navText, { color: index === pages.length - 1 ? theme.mutedText : theme.primary }]}>下一页</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  navButton: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  navText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  progress: { alignItems: 'center', gap: 7 },
  progressText: { fontSize: 13, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
