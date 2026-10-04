import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BOOK_TYPES, type BookType } from './types';
import { useTheme } from '../theme/ThemeProvider';

export const BOOK_TYPE_LABELS: Record<BookType, string> = {
  romance_male_male: '耽美',
  romance_female_male: '言情',
  romance_female_female: 'GL',
  no_romance: '无CP',
  other: '其他',
};

export function TypePicker({ value, onChange }: { value: BookType | null; onChange: (value: BookType | null) => void }) {
  const { theme } = useTheme();
  return <View style={styles.group}>
    {[null, ...BOOK_TYPES].map(type => <Pressable key={type ?? 'none'} accessibilityRole="radio"
      accessibilityState={{ checked: value === type }} onPress={() => onChange(type)}
      style={[styles.option, { borderColor: value === type ? theme.primary : theme.border, backgroundColor: value === type ? theme.primarySoft : theme.card }]}>
      <Text style={{ color: value === type ? theme.primary : theme.text, fontWeight: value === type ? '700' : '500' }}>{type === null ? '不分类' : BOOK_TYPE_LABELS[type]}</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#d6cec4', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  selected: { backgroundColor: '#28584E', borderColor: '#28584E' },
  text: { color: '#302a25' },
  selectedText: { color: '#fff', fontWeight: '700' },
});
