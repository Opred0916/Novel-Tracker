import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BOOK_STATUS_LABELS } from './status';
import type { Book } from './types';
import { BOOK_TYPE_LABELS } from './TypePicker';

export function BookDetail({ book }: { book: Book }) {
  return <View style={styles.container}>
    <Text style={styles.title}>{book.title}</Text>
    <Text style={styles.status}>{BOOK_STATUS_LABELS[book.status]}</Text>
    <View style={styles.section}>
      <Text style={styles.label}>作者</Text>
      <Text style={styles.value}>{book.author ?? '未填写作者'}</Text>
    </View>
    <View style={styles.section}>
      <Text style={styles.label}>作品类型</Text>
      <Text style={styles.value}>{book.bookType ? BOOK_TYPE_LABELS[book.bookType] : '未分类'}</Text>
      <Text style={styles.label}>标签</Text>
      <Text style={styles.value}>{book.tags.length ? book.tags.map(tag => tag.name).join(' · ') : '暂无标签'}</Text>
    </View>
    <View style={styles.section}>
      <Text style={styles.label}>总体评分</Text>
      <Text style={styles.value}>{book.ratingHalfStars === null ? '未评分' : `${book.ratingHalfStars / 2} / 5 星`}</Text>
    </View>
    <View style={styles.section}>
      <Text style={styles.label}>主角</Text>
      {book.protagonists.length
        ? book.protagonists.map((name, index) => <Text key={`${index}-${name}`} style={styles.value}>{name}</Text>)
        : <Text style={styles.value}>还没有记录主角</Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 18 },
  title: { fontSize: 28, fontWeight: '700', color: '#302a25' },
  status: { alignSelf: 'flex-start', color: '#593f72', backgroundColor: '#eee5f4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  section: { backgroundColor: '#fff', padding: 18, borderRadius: 14, gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#766f68' },
  value: { fontSize: 17, color: '#302a25' },
});
