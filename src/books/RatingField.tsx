import React from 'react';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
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
    <View style={styles.stars} accessible={false}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = (value ?? 0) - index * 2;
        const name = filled >= 2 ? 'star' : filled === 1 ? 'star-half' : 'star-outline';
        const fillLabel = name === 'star' ? '实心' : name === 'star-half' ? '半星' : '空心';
        return <Ionicons key={index} testID={`rating-star-${index + 1}`}
          accessibilityLabel={`第 ${index + 1} 颗星：${fillLabel}`} name={name} size={32}
          color={filled > 0 ? '#593f72' : '#b8aebe'} />;
      })}
    </View>
    {allowNewValue ? <Slider testID="rating-slider" accessibilityLabel="总体评分"
      minimumValue={0} maximumValue={5} step={0.5} value={value === null ? 0 : value / 2}
      minimumTrackTintColor="#593f72" maximumTrackTintColor="#d6cec4" thumbTintColor="#593f72"
      onValueChange={stars => onChange(stars === 0 ? null : Math.round(stars * 2))}
      style={styles.slider} /> : null}
    {value !== null ? <Pressable accessibilityRole="button" onPress={() => onChange(null)} style={styles.clear}>
      <Text style={styles.clearText}>清除评分</Text>
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 8 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25' },
  value: { color: '#593f72', fontSize: 17, fontWeight: '600' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slider: { width: '100%', height: 44 },
  clear: { alignSelf: 'flex-start', paddingVertical: 8 },
  clearText: { color: '#593f72', fontWeight: '600' },
});
