import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BOOK_TYPES, type BookType } from './types';
import { ChoiceChip } from '../ui/ChoiceChip';

export const BOOK_TYPE_LABELS: Record<BookType, string> = {
  romance_male_male: '耽美',
  romance_female_male: '言情',
  romance_female_female: 'GL',
  no_romance: '无CP',
  other: '其他',
};

export function TypePicker({ value, onChange }: { value: BookType | null; onChange: (value: BookType | null) => void }) {
  return <View style={styles.group}>
    {[null, ...BOOK_TYPES].map(type => <ChoiceChip key={type ?? 'none'} label={type === null ? '不分类' : BOOK_TYPE_LABELS[type]} selected={value === type} selectionRole="radio" onPress={() => onChange(type)} />)}
  </View>;
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
