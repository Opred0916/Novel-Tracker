import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { THEME_IDS, THEMES } from './theme';
import { useTheme } from './ThemeProvider';
import { BottomSheet } from '../ui/BottomSheet';

export function ThemePicker() {
  const { theme, themeId, setTheme, saveError } = useTheme();
  const [visible, setVisible] = useState(false);
  return <View accessibilityLabel="主题选择">
    <Text style={[styles.heading, { color: theme.text }]}>主题颜色</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>选择一套颜色，立即预览并保存在当前设备。</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="选择主题颜色" onPress={() => setVisible(true)} style={[styles.current, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.swatch, { backgroundColor: theme.primary }]} />
      <Text style={[styles.currentName, { color: theme.text }]}>{theme.name}</Text>
      <Text style={{ color: theme.primary }}>更换 ›</Text>
    </Pressable>
    {saveError ? <Text style={[styles.error, { color: theme.danger }]}>{saveError}</Text> : null}
    <BottomSheet visible={visible} title="选择主题颜色" onClose={() => setVisible(false)}><View style={styles.grid}>
      {THEME_IDS.map(id => {
        const selected = id === themeId;
        const palette = THEMES[id];
        return <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { void setTheme(id); setVisible(false); }} style={[styles.card, { backgroundColor: palette.primarySoft, borderColor: selected ? palette.primary : theme.border }]}>
          <View style={[styles.swatch, { backgroundColor: palette.primary }]} />
          <Text style={[styles.name, { color: palette.primary }]}>{palette.name}</Text>
          <Text style={[styles.check, { color: palette.primary }]}>{selected ? '✓ 已选' : '选择'}</Text>
        </Pressable>;
      })}
    </View></BottomSheet>
  </View>;
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700' }, help: { marginTop: 6, lineHeight: 20 }, current: { marginTop: 16, minHeight: 58, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, currentName: { flex: 1, fontSize: 16, fontWeight: '600' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, card: { width: '47%', minHeight: 82, borderWidth: 2, borderRadius: 14, padding: 12 }, swatch: { width: 26, height: 26, borderRadius: 13 }, name: { fontWeight: '700', marginTop: 8 }, check: { fontSize: 12, marginTop: 3 }, error: { marginTop: 10 },
});
