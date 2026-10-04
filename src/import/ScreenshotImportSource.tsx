import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ScreenshotImportDraft } from './screenshotImportDraft';

type Props = {
  draft: ScreenshotImportDraft;
  done: number;
  total: number;
  onPick: () => void;
  onMove: (from: number, to: number) => void;
  onRemove: (pageId: string) => void;
  onRetry: (pageId: string) => void;
  onTextChange: (pageId: string, text: string) => void;
  onContinuationChange: (pageId: string, value: boolean) => void;
  onParse: () => void;
};

export function ScreenshotImportSource({ draft, done, total, onPick, onMove, onRemove, onRetry, onTextChange, onContinuationChange, onParse }: Props) {
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text style={styles.heading}>导入截图旧记录</Text>
    <Text style={styles.progress}>已识别 {done}/{total} 张。图片只在本机处理，提交前都可以修改文字和顺序。</Text>
    <Pressable accessibilityRole="button" onPress={onPick} style={styles.secondary}><Text style={styles.secondaryText}>继续选择截图</Text></Pressable>
    {draft.pages.map((page, index) => {
      const status = page.ocrState === 'recognized' ? '已识别' : page.ocrState === 'empty' ? '未识别到文字' : page.ocrState === 'failed' ? '识别失败，可手动输入' : page.ocrState === 'unavailable' ? '本地识字不可用，可手动输入' : page.ocrState === 'manual' ? '已手动修改' : '等待识别';
      return <View key={page.id} style={styles.card}>
        <View style={styles.header}><Text style={styles.pageTitle}>第 {index + 1} 张</Text><Text style={styles.status}>{status}</Text></View>
        <Image source={{ uri: page.uri }} style={styles.image} resizeMode="contain" />
        <TextInput accessibilityLabel={`第 ${index + 1} 张文字`} multiline value={page.text} onChangeText={value => onTextChange(page.id, value)} placeholder="可手动输入或修正截图文字" style={styles.input} textAlignVertical="top" />
        <View style={styles.actions}>
          <Pressable accessibilityLabel={`第 ${index + 1} 张上移`} disabled={index === 0} onPress={() => onMove(index, index - 1)} style={[styles.action, index === 0 && styles.disabled]}><Text>向上</Text></Pressable>
          <Pressable accessibilityLabel={`第 ${index + 1} 张下移`} disabled={index === draft.pages.length - 1} onPress={() => onMove(index, index + 1)} style={[styles.action, index === draft.pages.length - 1 && styles.disabled]}><Text>向下</Text></Pressable>
          <Pressable accessibilityLabel={`第 ${index + 1} 张删除`} onPress={() => onRemove(page.id)} style={styles.action}><Text>删除</Text></Pressable>
          {page.ocrState === 'failed' || page.ocrState === 'unavailable' ? <Pressable accessibilityLabel={`第 ${index + 1} 张重试识别`} onPress={() => onRetry(page.id)} style={styles.action}><Text>重试</Text></Pressable> : null}
        </View>
        {index > 0 ? <Pressable accessibilityLabel={`第 ${index + 1} 张${page.continuesPrevious ? '取消接上一张' : '接上一张'}`} onPress={() => onContinuationChange(page.id, !page.continuesPrevious)} style={styles.continuation}><Text style={styles.continuationText}>{page.continuesPrevious ? '✓ 接上一张' : '接上一张'}</Text></Pressable> : null}
      </View>;
    })}
    <Pressable accessibilityRole="button" onPress={onParse} style={styles.primary}><Text style={styles.primaryText}>生成导入预览</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14, paddingBottom: 50 },
  heading: { fontSize: 25, fontWeight: '700', color: '#302a25' },
  progress: { color: '#766f68', lineHeight: 21 },
  card: { gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6cec4' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontWeight: '700', color: '#302a25' },
  status: { color: '#766f68', flexShrink: 1, textAlign: 'right' },
  image: { width: '100%', height: 170, backgroundColor: '#f3efe9', borderRadius: 8 },
  input: { minHeight: 120, borderWidth: 1, borderColor: '#d6cec4', borderRadius: 10, padding: 12, fontSize: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1ebf5' },
  disabled: { opacity: 0.35 },
  continuation: { alignSelf: 'flex-start', paddingVertical: 4 },
  continuationText: { color: '#593f72', fontWeight: '600' },
  primary: { backgroundColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#593f72', padding: 16, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: '#593f72', fontWeight: '700' },
});
