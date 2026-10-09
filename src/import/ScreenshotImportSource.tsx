import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ScreenshotImportDraft } from './screenshotImportDraft';
import { useTheme } from '../theme/ThemeProvider';
import { UI_LAYOUT } from '../ui/layout';

type Props = {
  draft: ScreenshotImportDraft;
  done: number;
  total: number;
  error?: string;
  onPick: () => void;
  onMove: (from: number, to: number) => void;
  onRemove: (pageId: string) => void;
  onRetry: (pageId: string) => void;
  onTextChange: (pageId: string, text: string) => void;
  onContinuationChange: (pageId: string, value: boolean) => void;
  onParse: () => void;
};

export function ScreenshotImportSource({ draft, done, total, error, onPick, onMove, onRemove, onRetry, onTextChange, onContinuationChange, onParse }: Props) {
  const { theme } = useTheme();
  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text style={[styles.heading, { color: theme.text }]}>导入截图旧记录</Text>
    <Text style={[styles.progress, { color: theme.mutedText }]}>已识别 {done}/{total} 张。图片只在本机处理，提交前都可以修改文字和顺序。</Text>
    {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <Pressable accessibilityRole="button" onPress={onPick} style={[styles.secondary, { backgroundColor: theme.card, borderColor: theme.primary }]}><Text style={[styles.secondaryText, { color: theme.primary }]}>继续选择截图</Text></Pressable>
    {draft.pages.map((page, index) => {
      const status = page.ocrState === 'recognized' ? '已识别' : page.ocrState === 'empty' ? '未识别到文字' : page.ocrState === 'failed' ? '识别失败，可手动输入' : page.ocrState === 'unavailable' ? '本地识字不可用，可手动输入' : page.ocrState === 'manual' ? '已手动修改' : '等待识别';
      return <View key={page.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.header}><Text style={[styles.pageTitle, { color: theme.text }]}>第 {index + 1} 张</Text><Text style={[styles.status, { color: theme.mutedText }]}>{status}</Text></View>
        <Image source={{ uri: page.uri }} style={styles.image} resizeMode="contain" />
        <TextInput accessibilityLabel={`第 ${index + 1} 张文字`} multiline value={page.text} onChangeText={value => onTextChange(page.id, value)} placeholder="可手动输入或修正截图文字" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} textAlignVertical="top" />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`第 ${index + 1} 张上移`} disabled={index === 0} onPress={() => onMove(index, index - 1)} style={[styles.action, { backgroundColor: theme.primarySoft }, index === 0 && styles.disabled]}><Text style={{ color: theme.text }}>向上</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`第 ${index + 1} 张下移`} disabled={index === draft.pages.length - 1} onPress={() => onMove(index, index + 1)} style={[styles.action, { backgroundColor: theme.primarySoft }, index === draft.pages.length - 1 && styles.disabled]}><Text style={{ color: theme.text }}>向下</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`第 ${index + 1} 张删除`} onPress={() => onRemove(page.id)} style={[styles.action, { backgroundColor: theme.primarySoft }]}><Text style={{ color: theme.danger }}>删除</Text></Pressable>
          {page.ocrState === 'failed' || page.ocrState === 'unavailable' ? <Pressable accessibilityRole="button" accessibilityLabel={`第 ${index + 1} 张重试识别`} onPress={() => onRetry(page.id)} style={[styles.action, { backgroundColor: theme.primarySoft }]}><Text style={{ color: theme.text }}>重试</Text></Pressable> : null}
        </View>
        {index > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={`第 ${index + 1} 张${page.continuesPrevious ? '取消接上一张' : '接上一张'}`} onPress={() => onContinuationChange(page.id, !page.continuesPrevious)} style={styles.continuation}><Text style={[styles.continuationText, { color: theme.primary }]}>{page.continuesPrevious ? '✓ 接上一张' : '接上一张'}</Text></Pressable> : null}
      </View>;
    })}
    <Pressable accessibilityRole="button" onPress={onParse} style={[styles.primary, { backgroundColor: theme.primary }]}><Text style={styles.primaryText}>生成导入预览</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: UI_LAYOUT.pageInset, gap: 14, paddingBottom: 100 },
  heading: { fontSize: 25, fontWeight: '700', color: '#302a25' },
  progress: { color: '#766f68', lineHeight: 21 },
  card: { gap: 10, padding: 14, borderRadius: UI_LAYOUT.groupRadius, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontWeight: '700', color: '#302a25' },
  status: { color: '#766f68', flexShrink: 1, textAlign: 'right' },
  image: { width: '100%', height: 170, backgroundColor: '#f3efe9', borderRadius: 8 },
  input: { minHeight: 120, borderWidth: 1, borderColor: '#d6cec4', borderRadius: 10, padding: 12, fontSize: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, justifyContent: 'center', borderRadius: 10 },
  disabled: { opacity: 0.35 },
  continuation: { alignSelf: 'flex-start', paddingVertical: 4 },
  continuationText: { color: '#28584E', fontWeight: '600' },
  primary: { backgroundColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: '#28584E', fontWeight: '700' },
  error: { color: '#b52626', lineHeight: 20 },
});
