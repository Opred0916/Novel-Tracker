import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { BOOK_STATUS_LABELS } from './status';
import type { Book } from './types';

export function BookCard({ book, onPress }: { book: Book; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`查看${book.title}`} onPress={onPress} style={styles.card}>
    <Text style={styles.title}>{book.title}</Text>
    <Text style={styles.status}>{BOOK_STATUS_LABELS[book.status]}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', padding: 18, borderRadius: 14, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '600', color: '#302a25', flexShrink: 1 },
  status: { color: '#80659d', marginLeft: 12 },
});
