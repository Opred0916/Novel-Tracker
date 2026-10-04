import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getDefaultCoverStyle } from './defaultCover';

export function BookCover({ title, bookId, uri, size = 'medium', showTitle = true }: { title: string; bookId?: string; uri?: string | null; size?: 'small' | 'medium' | 'large'; showTitle?: boolean }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const dimensions = size === 'small' ? styles.small : size === 'large' ? styles.large : styles.medium;
  if (uri && uri !== failedUri) return <Image accessibilityLabel={`${title}封面`} source={{ uri }} onError={() => setFailedUri(uri)} style={[styles.cover, dimensions]} />;
  const palette = getDefaultCoverStyle(bookId ?? 'preview');
  return <View accessibilityLabel={`${title}默认封面`} style={[styles.cover, styles.defaultCover, dimensions, { backgroundColor: palette.backgroundColor, borderColor: palette.accentColor }]}>
    {showTitle ? <Text numberOfLines={3} ellipsizeMode="tail" style={[styles.defaultTitle, { color: palette.accentColor }]}>{title}</Text> : null}
    <View style={[styles.accentLine, { backgroundColor: palette.accentColor }]} />
  </View>;
}

const styles = StyleSheet.create({
  cover: { borderRadius: 12, overflow: 'hidden' },
  small: { width: 64, height: 88 },
  medium: { width: 112, height: 156 },
  large: { width: 180, height: 250 },
  defaultCover: { alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1 },
  defaultTitle: { fontSize: 16, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  accentLine: { width: '42%', height: 3, borderRadius: 2, marginTop: 10 },
});
