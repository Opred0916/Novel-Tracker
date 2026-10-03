import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { todayLocalDate } from './readingDates';

type DateField = 'start' | 'end';

function dateFromLocalDay(value: string | null): Date {
  if (value === null) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function ReadingDateFields({ startedOn, endedOn, showEnd, onStartChange, onEndChange }: {
  startedOn: string | null;
  endedOn: string | null;
  showEnd: boolean;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const [activeField, setActiveField] = useState<DateField | null>(null);
  const [draftDate, setDraftDate] = useState(new Date());

  function open(field: DateField) {
    const value = dateFromLocalDay(field === 'start' ? startedOn : endedOn);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value, mode: 'date',
        onValueChange: (_event, selected) => {
          (field === 'start' ? onStartChange : onEndChange)(todayLocalDate(selected));
        },
      });
      return;
    }
    setDraftDate(value);
    setActiveField(field);
  }

  function finish() {
    if (activeField) {
      (activeField === 'start' ? onStartChange : onEndChange)(todayLocalDate(draftDate));
    }
    setActiveField(null);
  }

  if (Platform.OS === 'web') {
    return <View style={styles.group}>
      <Text style={styles.help}>日期格式：YYYY-MM-DD</Text>
      <Text style={styles.label}>开始日期</Text>
      <TextInput accessibilityLabel="开始日期" value={startedOn ?? ''} onChangeText={onStartChange} style={styles.input} />
      {showEnd ? <>
        <Text style={styles.label}>结束日期</Text>
        <TextInput accessibilityLabel="结束日期" value={endedOn ?? ''} onChangeText={onEndChange} style={styles.input} />
      </> : null}
    </View>;
  }

  return <View style={styles.group}>
    <Text style={styles.help}>{Platform.OS === 'ios' ? '轻点日期，滑动选择年、月、日。' : '轻点日期，选择年、月、日。'}</Text>
    <Text style={styles.label}>开始日期</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="开始日期" onPress={() => open('start')} style={styles.input}>
      <Text style={styles.dateText}>{startedOn ?? '日期未记录'}</Text>
    </Pressable>
    {showEnd ? <>
      <Text style={styles.label}>结束日期</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="结束日期" onPress={() => open('end')} style={styles.input}>
        <Text style={styles.dateText}>{endedOn ?? '日期未记录'}</Text>
      </Pressable>
    </> : null}
    {Platform.OS === 'ios' ? <Modal visible={activeField !== null} transparent animationType="slide" onRequestClose={() => setActiveField(null)}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => setActiveField(null)}><Text style={styles.action}>取消</Text></Pressable>
            <Text style={styles.sheetTitle}>选择{activeField === 'start' ? '开始' : '结束'}日期</Text>
            <Pressable accessibilityRole="button" onPress={finish}><Text style={styles.action}>完成</Text></Pressable>
          </View>
          {activeField ? <DateTimePicker value={draftDate} mode="date" display="spinner" locale="zh-CN" themeVariant="light"
            onValueChange={(_event, selected) => setDraftDate(selected)} /> : null}
        </View>
      </View>
    </Modal> : null}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 15, fontWeight: '600', color: '#302a25' },
  help: { fontSize: 13, color: '#766f68' },
  input: { borderColor: '#d6cec4', borderWidth: 1, borderRadius: 12, padding: 14, backgroundColor: '#fff' },
  dateText: { fontSize: 17, color: '#302a25' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 24 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  action: { fontSize: 17, color: '#634277', fontWeight: '600' },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: '#302a25' },
});
