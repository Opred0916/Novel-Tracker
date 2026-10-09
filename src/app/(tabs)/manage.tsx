import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackupReminderCard } from '../../dataSafety/BackupReminderCard';
import { dataSafetyPreferences } from '../../dataSafety/preferences';
import { shouldShowBackupReminder } from '../../dataSafety/visibility';
import { useBackupService } from '../../storage/AppProvider';
import { useTheme } from '../../theme/ThemeProvider';

function Action({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  const { theme } = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, { backgroundColor: primary ? theme.primary : theme.card, borderColor: theme.primary }]}>
    <Text style={{ color: primary ? theme.card : theme.primary, fontWeight: '700' }}>{label}</Text>
  </Pressable>;
}

export default function ManageTab() {
  const { theme } = useTheme();
  const backupService = useBackupService();
  const [showReminder, setShowReminder] = useState(false);
  const handledThisSession = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setShowReminder(false);
    Promise.all([backupService.getOverview(), dataSafetyPreferences.read('backupReminderHandled')])
      .then(([overview, handled]) => {
        if (active && !handledThisSession.current) {
          setShowReminder(shouldShowBackupReminder({ handled, bookCount: overview.counts.books, lastGeneratedAt: overview.lastGeneratedAt }));
        }
      })
      .catch(() => { if (active) setShowReminder(false); });
    return () => { active = false; };
  }, [backupService]));

  function handleReminder(openBackup: boolean) {
    handledThisSession.current = true;
    setShowReminder(false);
    void dataSafetyPreferences.mark('backupReminderHandled').catch(() => undefined);
    if (openBackup) router.push('/settings/backup');
  }

  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
    <Text style={[styles.heading, { color: theme.text }]}>管理</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>维护标签、导入记录、备份数据和应用外观。</Text>
    {showReminder ? <BackupReminderCard onBackup={() => handleReminder(true)} onDismiss={() => handleReminder(false)} /> : null}
    <Text style={[styles.section, { color: theme.text }]}>整理书库</Text>
    <Action label="快捷标签设置" onPress={() => router.push('/settings/tags')} />
    <Action label="数据管理" onPress={() => router.push('/settings/data')} />
    <Action label="书库概览" onPress={() => router.push('/settings/overview')} />
    <Text style={[styles.section, { color: theme.text }]}>导入与导出</Text>
    <Action label="追加旧记录" primary onPress={() => router.push('/settings/import')} />
    <Action label="导出开放格式" onPress={() => router.push('/settings/export')} />
    <Action label="备份与恢复" onPress={() => router.push('/settings/backup')} />
    <Action label="使用与数据安全" onPress={() => router.push('/settings/data-safety')} />
    <Text style={[styles.section, { color: theme.text }]}>外观</Text>
    <Action label="主题颜色" onPress={() => router.push('/settings/appearance')} />
    <View style={styles.bottomSpace} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 22, gap: 12, paddingBottom: 36 }, heading: { fontSize: 28, fontWeight: '800', marginTop: 10 }, help: { lineHeight: 21 }, section: { fontSize: 18, fontWeight: '700', marginTop: 14 }, action: { borderWidth: 1, borderRadius: 14, padding: 16, alignItems: 'center' }, bottomSpace: { height: 24 },
});
