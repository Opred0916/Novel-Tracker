import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BOOK_TYPES, type BookType } from './types';

export const BOOK_TYPE_LABELS: Record<BookType, string> = {
  romance_male_male: '耽美',
  romance_female_male: '言情',
  romance_female_female: 'GL',
  no_romance: '无CP',
  other: '其他',
};

export function TypePicker({ value, onChange }: { value: BookType | null; onChange: (value: BookType | null) => void }) {
  return <View style={styles.group}>
    {[null, ...BOOK_TYPES].map(type => <Pressable key={type ?? 'none'} accessibilityRole="radio"
      accessibilityState={{ checked: value === type }} onPress={() => onChange(type)}
      style={[styles.option, value === type && styles.selected]}>
      <Text style={[styles.text, value === type && styles.selectedText]}>{type === null ? '不分类' : BOOK_TYPE_LABELS[type]}</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#d6cec4', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  selected: { backgroundColor: '#593f72', borderColor: '#593f72' },
  text: { color: '#302a25' },
  selectedText: { color: '#fff', fontWeight: '700' },
});
