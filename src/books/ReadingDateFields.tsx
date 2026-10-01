import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export function ReadingDateFields({ startedOn, endedOn, showEnd, onStartChange, onEndChange }: {
  startedOn: string;
  endedOn: string;
  showEnd: boolean;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return <View style={styles.group}>
    <Text style={styles.help}>日期格式：YYYY-MM-DD，可修改默认的今天。</Text>
    <Text style={styles.label}>开始日期</Text>
    <TextInput accessibilityLabel="开始日期" value={startedOn} onChangeText={onStartChange}
      placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" autoCorrect={false} style={styles.input} />
    {showEnd ? <>
      <Text style={styles.label}>结束日期</Text>
      <TextInput accessibilityLabel="结束日期" value={endedOn} onChangeText={onEndChange}
        placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" autoCorrect={false} style={styles.input} />
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25' },
  help: { fontSize: 13, color: '#766f68' },
  input: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: '#fff' },
});
