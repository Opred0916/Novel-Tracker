import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { ChoiceChip } from '../ui/ChoiceChip';

export function SuggestionField({ label, value, onChange, placeholder, suggestions }: { label: string; value: string; onChange(value: string): void; placeholder: string; suggestions?: string[] }) {
  const { theme } = useTheme();
  const options = [...new Set((suggestions ?? []).map(value => value.trim()).filter(Boolean))];
  return <View style={styles.container}>
    <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={theme.mutedText} value={value} onChangeText={onChange} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
    {options.length ? <View style={styles.suggestions}>{options.map(option => <ChoiceChip key={option} label={option} selected={value === option} selectionRole="radio" onPress={() => onChange(option)} />)}</View> : null}
  </View>;
}

const styles = StyleSheet.create({ container: { gap: 7 }, label: { fontSize: 15, fontWeight: '600', marginTop: 8 }, input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 17 }, suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
