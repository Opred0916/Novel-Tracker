import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { THEME_IDS, THEMES } from './theme';
import { useTheme } from './ThemeProvider';

export function ThemePicker() {
  const { theme, themeId, setTheme, saveError } = useTheme();
  return <View accessibilityLabel="主题选择">
    {saveError ? <Text style={[styles.error, { color: theme.danger }]}>{saveError}</Text> : null}
    <View style={styles.grid}>
      {THEME_IDS.map(id => {
        const selected = id === themeId;
        const palette = THEMES[id];
        return <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { void setTheme(id); }} style={[styles.card, { backgroundColor: palette.primarySoft, borderColor: selected ? palette.primary : theme.border }]}>
          <View style={[styles.swatch, { backgroundColor: palette.primary }]} />
          <Text style={[styles.name, { color: palette.primary }]}>{palette.name}</Text>
          <Text style={[styles.check, { color: palette.primary }]}>{selected ? '✓ 已选' : '选择'}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700' }, help: { marginTop: 6, lineHeight: 20 }, current: { marginTop: 16, minHeight: 58, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, currentName: { flex: 1, fontSize: 16, fontWeight: '600' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, card: { width: '47%', minHeight: 82, borderWidth: 2, borderRadius: 14, padding: 12 }, swatch: { width: 26, height: 26, borderRadius: 13 }, name: { fontWeight: '700', marginTop: 8 }, check: { fontSize: 12, marginTop: 3 }, error: { marginTop: 10 },
});
