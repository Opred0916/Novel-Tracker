import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ImageAsset } from './types';
import { useTheme } from '../theme/ThemeProvider';
import { UI_LAYOUT } from '../ui/layout';

export type ImagePreviewStatus = 'pending' | 'processing' | 'recognized' | 'empty' | 'failed' | 'unavailable';

export function ImagePreview({ image, visible, status, recognizedText, onClose, onRetry }: {
  image: ImageAsset | null;
  visible: boolean;
  status?: ImagePreviewStatus;
  recognizedText?: string | null;
  onClose: () => void;
  onRetry?: () => void;
}) {
  const { theme } = useTheme();
  if (!image) return null;
  const currentStatus = status ?? 'pending';
  const statusText = currentStatus === 'processing' ? '正在识别图片文字…'
    : currentStatus === 'recognized' ? '图片文字'
      : currentStatus === 'empty' ? '未识别到文字'
        : currentStatus === 'failed' ? '图片文字识别失败'
          : currentStatus === 'unavailable' ? '当前版本暂不支持本地图片文字识别'
            : '等待识别图片文字';
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={[styles.panel, { backgroundColor: theme.card }]}>
        <View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>精彩片段</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭图片预览" onPress={onClose}><Text style={[styles.close, { color: theme.primary }]}>关闭</Text></Pressable></View>
        <Image accessibilityLabel="精彩片段预览" source={{ uri: image.localPath }} resizeMode="contain" style={styles.image} />
        <Text style={[styles.status, { color: theme.mutedText }]}>{statusText}</Text>
        {recognizedText ? <ScrollView style={styles.recognizedScroll}><Text style={[styles.text, { color: theme.text }]}>{recognizedText}</Text></ScrollView> : null}
        {currentStatus === 'failed' && onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.retry, { backgroundColor: theme.primary }]}><Text style={styles.retryText}>重试识别</Text></Pressable> : null}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'center', padding: 18 },
  panel: { borderRadius: UI_LAYOUT.groupRadius, padding: 16, gap: 12, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#302a25', fontSize: 18, fontWeight: '700' }, close: { color: '#28584E', fontWeight: '700' },
  image: { width: '100%', height: 360, backgroundColor: '#f4f0eb', borderRadius: 10 },
  status: { color: '#766f68', fontWeight: '600' }, recognizedScroll: { flexShrink: 1 }, text: { lineHeight: 22 },
  retry: { alignSelf: 'flex-start', backgroundColor: '#28584E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }, retryText: { color: '#fff', fontWeight: '700' },
});
