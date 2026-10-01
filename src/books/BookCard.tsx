import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Book } from './types';

export function BookCard({ book, onPress }: { book: Book; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`查看${book.title}`} onPress={onPress} style={styles.card}>
    <View style={styles.details}>
      <Text style={styles.title}>{book.title}</Text>
      {book.author ? <Text style={styles.author}>{book.author}</Text> : null}
    </View>
    {book.ratingHalfStars !== null ? <Text style={styles.rating}>{book.ratingHalfStars / 2} / 5 星</Text> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', padding: 18, borderRadius: 14, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  details: { flex: 1, gap: 4 },
  title: { fontSize: 17, fontWeight: '600', color: '#302a25', flexShrink: 1 },
  author: { color: '#766f68' }, rating: { color: '#80659d' },
});
