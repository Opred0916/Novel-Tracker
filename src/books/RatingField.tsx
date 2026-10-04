import React from 'react';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type RatingFieldProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  allowNewValue: boolean;
};

export function RatingField({ value, onChange, allowNewValue }: RatingFieldProps) {
  const { theme } = useTheme();
  return <View style={styles.container}>
    <Text style={[styles.label, { color: theme.text }]}>总体评分</Text>
    <Text style={[styles.value, { color: theme.rating }]}>{value === null ? '未评分' : `${value / 2} / 5 星`}</Text>
    <View style={styles.stars} accessible={false}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = (value ?? 0) - index * 2;
        const name = filled >= 2 ? 'star' : filled === 1 ? 'star-half' : 'star-outline';
        const fillLabel = name === 'star' ? '实心' : name === 'star-half' ? '半星' : '空心';
        return <Ionicons key={index} testID={`rating-star-${index + 1}`}
          accessibilityLabel={`第 ${index + 1} 颗星：${fillLabel}`} name={name} size={32}
          color={filled > 0 ? theme.rating : '#B8AEBE'} />;
      })}
    </View>
    {allowNewValue ? <Slider testID="rating-slider" accessibilityLabel="总体评分"
      accessibilityValue={{ min: 0, max: 5, now: value === null ? 0 : value / 2,
        text: value === null ? '未评分' : `${value / 2} 星` }}
      minimumValue={0} maximumValue={5} step={0.5} value={value === null ? 0 : value / 2}
      minimumTrackTintColor={theme.primary} maximumTrackTintColor={theme.border} thumbTintColor={theme.primary}
      onValueChange={stars => onChange(stars === 0 ? null : Math.round(stars * 2))}
      style={styles.slider} /> : null}
    {value !== null ? <Pressable accessibilityRole="button" onPress={() => onChange(null)} style={styles.clear}>
      <Text style={[styles.clearText, { color: theme.primary }]}>清除评分</Text>
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 8 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25' },
  value: { color: '#28584E', fontSize: 17, fontWeight: '600' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slider: { width: '100%', height: 44 },
  clear: { alignSelf: 'flex-start', paddingVertical: 8 },
  clearText: { color: '#28584E', fontWeight: '600' },
});
