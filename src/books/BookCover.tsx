import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export function BookCover({ title, uri, size = 'medium', showTitle = true }: { title: string; uri?: string | null; size?: 'small' | 'medium' | 'large'; showTitle?: boolean }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const dimensions = size === 'small' ? styles.small : size === 'large' ? styles.large : styles.medium;
  if (uri && uri !== failedUri) return <Image accessibilityLabel={`${title}封面`} source={{ uri }} onError={() => setFailedUri(uri)} style={[styles.cover, dimensions]} />;
  return <View accessibilityLabel={`${title}默认封面`} style={[styles.cover, styles.defaultCover, dimensions]}>
    {showTitle ? <Text numberOfLines={3} ellipsizeMode="tail" style={styles.defaultTitle}>{title}</Text> : null}
    <Text style={styles.defaultMark}>NOVEL TRACKER</Text>
  </View>;
}

const styles = StyleSheet.create({
  cover: { borderRadius: 12, overflow: 'hidden' },
  small: { width: 64, height: 88 },
  medium: { width: 112, height: 156 },
  large: { width: 180, height: 250 },
  defaultCover: { backgroundColor: '#63447d', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#8b6aa4' },
  defaultTitle: { color: '#fffaf2', fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  defaultMark: { color: '#d9c9e4', fontSize: 8, letterSpacing: 1, marginTop: 10 },
});
