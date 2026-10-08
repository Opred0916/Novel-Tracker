import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { AnnualSummaryPoster } from './AnnualSummaryPoster';
import type { AnnualStorySummary } from './annualSummaryRepository';
import {
  DEFAULT_ANNUAL_SUMMARY_PRIVACY,
  makeAnnualSummarySnapshot,
  type AnnualSummaryPrivacy,
} from './annualSummarySnapshot';
import { captureRecapPng, discardRecapPng, saveRecapPng, shareRecapPng } from './recapSharePlatform';

function resultMessage(error: unknown, action: 'save' | 'share'): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: string }).code;
    if (code === 'permission_denied') return '未获得相册写入权限，可以改用系统分享';
    if (code === 'unavailable') return '这台设备暂时无法使用系统分享';
  }
  return action === 'save' ? '保存失败，请重试' : '无法打开分享面板，请重试';
}

function PrivacyToggle({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  const { theme } = useTheme();
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={[styles.toggle, { borderColor: value ? theme.primary : theme.border, backgroundColor: value ? theme.primarySoft : theme.card }]}>
    <Text style={[styles.toggleLabel, { color: value ? theme.primary : theme.mutedText }]}>{label}</Text>
    <Text style={[styles.toggleValue, { color: value ? theme.primary : theme.mutedText }]}>{value ? '显示' : '隐藏'}</Text>
  </Pressable>;
}

export function AnnualSummarySharePanel(props: { summary: AnnualStorySummary; initialPrivacy?: AnnualSummaryPrivacy }) {
  return <AnnualSummarySharePanelInner key={props.summary.year} {...props} />;
}

function AnnualSummarySharePanelInner({ summary, initialPrivacy = DEFAULT_ANNUAL_SUMMARY_PRIVACY }: { summary: AnnualStorySummary; initialPrivacy?: AnnualSummaryPrivacy }) {
  const { theme } = useTheme();
  const [privacy, setPrivacy] = useState<AnnualSummaryPrivacy>(() => ({ ...initialPrivacy }));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const posterRef = useRef<View>(null);
  const busyRef = useRef(false);
  const activeRef = useRef(true);
  const snapshot = useMemo(() => makeAnnualSummarySnapshot(summary, privacy, theme), [privacy, summary, theme]);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const onReady = useCallback((value: boolean) => {
    if (activeRef.current) setReady(value);
  }, []);

  function changePrivacy(key: keyof AnnualSummaryPrivacy, value: boolean) {
    setReady(false);
    setMessage('');
    setPrivacy(previous => ({ ...previous, [key]: value }));
  }

  async function run(action: 'save' | 'share') {
    if (busyRef.current || !ready || !posterRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    let uri: string | null = null;
    try {
      uri = await captureRecapPng(posterRef.current);
      if (!activeRef.current) return;
      if (action === 'save') {
        await saveRecapPng(uri);
        if (activeRef.current) setMessage('已保存到相册');
      } else {
        await shareRecapPng(uri);
        if (activeRef.current) setMessage('系统分享面板已关闭');
      }
    } catch (error) {
      if (activeRef.current) setMessage(resultMessage(error, action));
    } finally {
      if (uri) discardRecapPng(uri);
      busyRef.current = false;
      if (activeRef.current) setBusy(false);
    }
  }

  return <View style={styles.panel}>
    <Text style={[styles.heading, { color: theme.text }]}>年度海报</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>图片可能包含书名和封面，分享前请确认。</Text>
    <View style={styles.toggles}>
      <PrivacyToggle label="显示书名" value={privacy.showTitles} onChange={value => changePrivacy('showTitles', value)} />
      <PrivacyToggle label="显示封面" value={privacy.showCovers} onChange={value => changePrivacy('showCovers', value)} />
      <PrivacyToggle label="显示想法与片段统计" value={privacy.showArchiveStats} onChange={value => changePrivacy('showArchiveStats', value)} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.preview}>
      <AnnualSummaryPoster ref={posterRef} snapshot={snapshot} onReady={onReady} />
    </ScrollView>
    {!ready ? <Text style={[styles.help, { color: theme.mutedText }]}>正在准备封面…</Text> : null}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="保存到相册" accessibilityState={{ disabled: !ready || busy }} disabled={!ready || busy} onPress={() => { void run('save'); }} style={[styles.primary, { backgroundColor: theme.primary }, (!ready || busy) && styles.disabled]}><Text style={styles.primaryText}>保存到相册</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="系统分享" accessibilityState={{ disabled: !ready || busy }} disabled={!ready || busy} onPress={() => { void run('share'); }} style={[styles.secondary, { borderColor: theme.primary }, (!ready || busy) && styles.disabled]}><Text style={[styles.secondaryText, { color: theme.primary }]}>系统分享</Text></Pressable>
    </View>
    {message ? <Text accessibilityRole="alert" style={[styles.message, { color: theme.text }]}>{message}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { gap: 14 },
  heading: { fontSize: 28, lineHeight: 36, fontWeight: '900' },
  help: { fontSize: 14, lineHeight: 21 },
  toggles: { gap: 8 },
  toggle: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontWeight: '800' },
  toggleValue: { fontSize: 13, fontWeight: '700' },
  preview: { paddingRight: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  secondary: { flex: 1, paddingVertical: 14, borderWidth: 1, borderRadius: 14, alignItems: 'center' },
  secondaryText: { fontWeight: '800' },
  disabled: { opacity: 0.42 },
  message: { textAlign: 'center', fontSize: 14, lineHeight: 21 },
});
