import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type RatingFieldProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  allowNewValue: boolean;
};

export function RatingField({ value, onChange, allowNewValue }: RatingFieldProps) {
  return <View style={styles.container}>
    <Text style={styles.label}>总体评分</Text>
    <Text style={styles.value}>{value === null ? '未评分' : `${value / 2} / 5 星`}</Text>
    {allowNewValue ? <View style={styles.choices}>
      {Array.from({ length: 10 }, (_, index) => index + 1).map(halfStars => <Pressable
        key={halfStars} accessibilityRole="radio" accessibilityLabel={`${halfStars / 2} 星`}
        accessibilityState={{ checked: value === halfStars }} onPress={() => onChange(halfStars)}
        style={[styles.choice, value === halfStars && styles.selected]}>
        <Text style={[styles.choiceText, value === halfStars && styles.selectedText]}>{halfStars / 2} ★</Text>
      </Pressable>)}
    </View> : null}
    {value !== null ? <Pressable accessibilityRole="button" onPress={() => onChange(null)} style={styles.clear}>
      <Text style={styles.clearText}>清除评分</Text>
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 8 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25' },
  value: { color: '#593f72', fontSize: 17, fontWeight: '600' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minWidth: 56, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: '#d6cec4', alignItems: 'center', backgroundColor: '#fff' },
  selected: { backgroundColor: '#593f72', borderColor: '#593f72' },
  choiceText: { color: '#302a25', fontSize: 14 },
  selectedText: { color: '#fff', fontWeight: '700' },
  clear: { alignSelf: 'flex-start', paddingVertical: 8 },
  clearText: { color: '#593f72', fontWeight: '600' },
});
