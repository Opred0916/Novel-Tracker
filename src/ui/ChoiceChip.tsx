import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function ChoiceChip({
  label,
  selected,
  selectionRole,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  selectionRole: 'radio' | 'checkbox';
  onPress(): void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  return <Pressable
    accessibilityRole={selectionRole}
    accessibilityState={{ checked: selected, disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.option,
      { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : theme.card },
      pressed && !disabled ? { backgroundColor: selected ? theme.primaryPressed : theme.primarySoft } : null,
      disabled ? styles.disabled : null,
    ]}
  >
    <Text style={[styles.text, { color: selected ? theme.card : theme.text, fontWeight: selected ? '700' : '500' }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  option: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  text: { fontSize: 15 },
  disabled: { opacity: 0.45 },
});
