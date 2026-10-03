import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BOOK_STATUS_LABELS } from './status';
import type { Book, ReadingSession } from './types';
import { BOOK_TYPE_LABELS } from './TypePicker';
import { BookCover } from './BookCover';

export function BookDetail({ book, sessions = [], onEditReading }: {
  book: Book;
  sessions?: ReadingSession[];
  onEditReading?: (sessionId: string) => void;
}) {
  const ordered = [...sessions].sort((a, b) => a.ordinal - b.ordinal);
  return <View style={styles.container}>
    <BookCover title={book.title} uri={book.coverUri} size="large" showTitle />
    <Text style={styles.title}>{book.title}</Text>
    <Text style={styles.status}>{BOOK_STATUS_LABELS[book.status]}</Text>
    <View style={styles.section}>
      <Text style={styles.label}>作者</Text>
      <Text style={styles.value}>{book.author ?? '未填写作者'}</Text>
    </View>
    {book.whyWantToRead || book.platform ? <View style={styles.section}>
      {book.whyWantToRead ? <>
        <Text style={styles.label}>为什么想看</Text>
        <Text style={styles.value}>{book.whyWantToRead}</Text>
      </> : null}
      {book.platform ? <>
        <Text style={styles.label}>阅读平台</Text>
        <Text style={styles.value}>{book.platform}</Text>
      </> : null}
    </View> : null}
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
      <Text style={styles.label}>阅读历史</Text>
      {book.legacyReadCount === 1 ? <View style={styles.historyItem}>
        <Text style={styles.value}>第 1 次阅读 · 读完 · 日期未记录</Text>
        {onEditReading ? <Pressable accessibilityRole="button" onPress={() => onEditReading('first')}>
          <Text style={styles.link}>补记首刷日期</Text>
        </Pressable> : null}
      </View> : null}
      {ordered.map(session => <View key={session.id} style={styles.historyItem}>
        <Text style={styles.value}>第 {session.ordinal} 次阅读 · {BOOK_STATUS_LABELS[session.outcome]}</Text>
        <Text style={styles.date}>{session.startedOn ?? '日期未记录'} — {session.endedOn ?? (session.outcome === 'reading' ? '在读中' : '日期未记录')}</Text>
        {onEditReading ? <Pressable accessibilityRole="button" onPress={() => onEditReading(session.id)}>
          <Text style={styles.link}>编辑第 {session.ordinal} 次阅读</Text>
        </Pressable> : null}
      </View>)}
      {!book.legacyReadCount && ordered.length === 0 ? <Text style={styles.value}>暂无阅读记录</Text> : null}
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
  historyItem: { gap: 5, paddingVertical: 6 },
  date: { fontSize: 14, color: '#766f68' },
  link: { fontSize: 14, color: '#593f72', fontWeight: '600', paddingVertical: 4 },
});
