import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BackupReminderCard } from '../../dataSafety/BackupReminderCard';
import { dataSafetyPreferences } from '../../dataSafety/preferences';
import { shouldShowBackupReminder } from '../../dataSafety/visibility';
import { useBackupService } from '../../storage/AppProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { TabPageHeader } from '../../ui/TabPageHeader';
import { GroupedSection } from '../../ui/GroupedSection';
import { ActionRow } from '../../ui/ActionRow';
import { UI_LAYOUT } from '../../ui/layout';

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

  const divider = <View style={[styles.divider, { backgroundColor: theme.border }]} />;
  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
    <TabPageHeader title="管理" subtitle="维护书库和应用设置" />
    <View style={styles.body}>
    {showReminder ? <BackupReminderCard onBackup={() => handleReminder(true)} onDismiss={() => handleReminder(false)} /> : null}
    <GroupedSection title="书库维护">
      <ActionRow label="快捷标签设置" detail="选择添加书目时显示的标签" onPress={() => router.push('/settings/tags')} />
      {divider}<ActionRow label="书库概览" detail="查看书架本数和阅读状态" onPress={() => router.push('/settings/overview')} />
    </GroupedSection>
    <GroupedSection title="数据与安全">
      <ActionRow label="追加旧记录" detail="从文字、表格或截图导入" onPress={() => router.push('/settings/import')} />
      {divider}<ActionRow label="导出开放格式" onPress={() => router.push('/settings/export')} />
      {divider}<ActionRow label="备份与恢复" onPress={() => router.push('/settings/backup')} />
      {divider}<ActionRow label="使用与数据安全" onPress={() => router.push('/settings/data-safety')} />
    </GroupedSection>
    <GroupedSection title="外观">
      <ActionRow label="主题颜色" detail={`当前：${theme.name}`} onPress={() => router.push('/settings/appearance')} />
    </GroupedSection>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 36 }, body: { paddingHorizontal: UI_LAYOUT.pageInset, gap: UI_LAYOUT.sectionGap }, divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
