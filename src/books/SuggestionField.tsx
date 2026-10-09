import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { ChoiceChip } from '../ui/ChoiceChip';

export function SuggestionField({ label, value, onChange, placeholder, suggestions, onRemoveSuggestion }: { label: string; value: string; onChange(value: string): void; placeholder: string; suggestions?: string[]; onRemoveSuggestion?: (value: string) => void }) {
  const { theme } = useTheme();
  const options = [...new Set((suggestions ?? []).map(value => value.trim()).filter(Boolean))];
  return <View style={styles.container}>
    <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={theme.mutedText} value={value} onChangeText={onChange} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
    {options.length ? <View style={styles.suggestions}>{options.map(option => <View key={option} style={styles.option}><ChoiceChip label={option} selected={value === option} selectionRole="radio" onPress={() => onChange(option)} />{onRemoveSuggestion ? <Pressable accessibilityRole="button" accessibilityLabel={`删除${label}记录：${option}`} onPress={() => onRemoveSuggestion(option)} style={styles.remove}><Text style={[styles.removeText, { color: theme.mutedText }]}>×</Text></Pressable> : null}</View>)}</View> : null}
  </View>;
}

const styles = StyleSheet.create({ container: { gap: 7 }, label: { fontSize: 15, fontWeight: '600', marginTop: 8 }, input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 17 }, suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { flexDirection: 'row', alignItems: 'center' }, remove: { minWidth: 32, minHeight: 40, alignItems: 'center', justifyContent: 'center' }, removeText: { fontSize: 22 },
});
