import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAccount } from '../../account/AccountProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { UI_LAYOUT } from '../../ui/layout';
import { useSync } from '../../sync/SyncProvider';
import { router } from 'expo-router';
import { useDatabase } from '../../storage/AppProvider';
import { openDatabase } from '../../storage/database';
import { GuestImportService } from '../../account/guestImport';
import { ExpoImageFilePort } from '../../sync/expoImagePorts';
import { AccountDeletionService, SupabaseAccountDeletion } from '../../account/accountDeletion';
import { LocalAccountCache } from '../../account/localAccountCache';
import { getSupabaseClient } from '../../account/supabaseClient';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';

export default function AccountPage() {
  const { user, configured, sendCode, verifyCode, signOut } = useAccount();
  const { theme } = useTheme();
  const sync = useSync();
  const accountDb = useDatabase();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [guestOffer, setGuestOffer] = useState<{ guestBooks: number; alreadyImported: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void openDatabase().then(async guestDb => {
      try {
        const offer = await new GuestImportService(guestDb, accountDb, new ExpoImageFilePort()).offer();
        if (active) setGuestOffer(offer);
      } finally { await guestDb.closeAsync(); }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user, accountDb]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage('');
    try { await action(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作失败，请稍后重试'); }
    finally { setBusy(false); }
  }

  function confirmGuestImport() {
    if (!user) return;
    Alert.alert('导入未登录书库？', `将 ${guestOffer?.guestBooks ?? 0} 本小说复制到当前账号书库，原未登录书库会保留。若两边有不同版本的同一条记录，将停止导入。`, [
      { text: '取消', style: 'cancel' },
      { text: '复制并导入', onPress: () => { void run(async () => {
        const guestDb = await openDatabase();
        try { await new GuestImportService(guestDb, accountDb, new ExpoImageFilePort()).import(user.id); }
        finally { await guestDb.closeAsync(); }
        setGuestOffer({ guestBooks: guestOffer?.guestBooks ?? 0, alreadyImported: true });
        await sync.syncNow();
      }, '未登录书库已复制到当前账号'); } },
    ]);
  }

  function confirmDeletion() {
    if (!user) return;
    Alert.alert('永久删除账号？', '云端书库、图片及这台设备的账号缓存将删除，且无法撤销。未登录书库不会删除。请先在“备份与恢复”中保存独立备份。', [
      { text: '取消', style: 'cancel' },
      { text: '继续', style: 'destructive', onPress: () => Alert.alert('再次确认删除', `删除 ${user.email ?? '当前账号'} 的云端数据？`, [
        { text: '取消', style: 'cancel' },
        { text: '永久删除', style: 'destructive', onPress: () => { void (async () => {
          setBusy(true);
          try {
            const client = getSupabaseClient();
            if (!client) throw new Error('云同步尚未配置');
            const cache = new LocalAccountCache(user.id, {
              close: async () => { await sync.pause(); await accountDb.closeAsync(); },
              deleteDatabase: name => SQLite.deleteDatabaseAsync(name),
              removeDirectory: path => FileSystem.deleteAsync(path, { idempotent: true }),
              documentDirectory: FileSystem.documentDirectory,
              cacheDirectory: FileSystem.cacheDirectory,
            });
            await new AccountDeletionService(new SupabaseAccountDeletion(client), cache, { signOut }).delete();
            Alert.alert('账号已删除', '云端账号和这台设备的账号缓存已删除。未登录书库仍在。');
          } catch (cause) {
            const detail = cause instanceof Error ? cause.message : '请稍后重试；在确认删除完成前不要清除本机数据。';
            Alert.alert(detail.startsWith('云端账号已删除') ? '本机清理未完成' : '删除未完成', detail);
          } finally { setBusy(false); }
        })(); } },
      ]) },
    ]);
  }

  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
    <Text style={[styles.heading, { color: theme.text }]}>账号与同步</Text>
    {!configured ? <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.body, { color: theme.text }]}>云同步尚未配置。当前书库仍保存在本机，可以继续使用和手动备份。</Text>
    </View> : user ? <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>已登录</Text>
      <Text style={[styles.body, { color: theme.mutedText }]}>{user.email ?? '邮箱账号'}</Text>
      <Text style={[styles.body, { color: theme.mutedText }]}>这台设备为该账号保留独立书库。书库与图片会保存到云端；请仍定期保留独立备份。</Text>
      {guestOffer && guestOffer.guestBooks > 0 && !guestOffer.alreadyImported ? <Pressable accessibilityRole="button" disabled={busy} onPress={confirmGuestImport} style={[styles.secondaryButton, { borderColor: theme.primary }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>复制未登录书库的 {guestOffer.guestBooks} 本小说</Text></Pressable> : null}
      <Text style={[styles.body, { color: theme.text }]}>同步状态：{{ syncing: '正在同步', synced: '已同步', retry: '等待重试', conflict: '需要处理冲突', error: '同步失败', guest: '未登录' }[sync.status]}</Text>
      {sync.error ? <Text accessibilityRole="alert" style={[styles.body, { color: theme.danger }]}>{sync.error}</Text> : null}
      {sync.status === 'conflict' ? <><Text style={[styles.body, { color: theme.danger }]}>发现 {sync.conflicts.length} 处冲突。为保护两边记录，自动同步已暂停。</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings/sync-conflicts')} style={[styles.secondaryButton, { borderColor: theme.primary }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>处理冲突</Text></Pressable></> : null}
      <Pressable accessibilityRole="button" disabled={busy || sync.status === 'syncing' || sync.status === 'conflict'} onPress={() => { void sync.syncNow(); }} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={[styles.buttonText, { color: theme.card }]}>立即同步</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => Alert.alert('退出账号', '退出后切回本机未登录书库；账号本地记录会保留。', [
        { text: '取消', style: 'cancel' },
        { text: '退出', onPress: () => { void run(signOut, '已退出账号'); } },
      ])} style={[styles.secondaryButton, { borderColor: theme.primary }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>退出账号</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={confirmDeletion} style={[styles.secondaryButton, { borderColor: theme.danger }]}><Text style={{ color: theme.danger, fontWeight: '700' }}>删除账号</Text></Pressable>
    </View> : <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>邮箱登录</Text>
      <Text style={[styles.body, { color: theme.mutedText }]}>登录后会打开这个账号的独立书库，并将该书库的记录和图片同步到云端。未登录书库不会自动搬入或删除；请先备份重要记录。</Text>
      <TextInput accessibilityLabel="邮箱" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="邮箱地址" placeholderTextColor={theme.mutedText} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void run(async () => { await sendCode(email); setCodeSent(true); }, '验证码已发送，请检查邮箱'); }} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={[styles.buttonText, { color: theme.card }]}>{busy ? '请稍候' : codeSent ? '重新发送验证码' : '发送验证码'}</Text></Pressable>
      {codeSent ? <><TextInput accessibilityLabel="验证码" keyboardType="number-pad" maxLength={8} value={code} onChangeText={setCode} placeholder="输入验证码" placeholderTextColor={theme.mutedText} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void run(() => verifyCode(email, code), '登录成功'); }} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={[styles.buttonText, { color: theme.card }]}>验证并登录</Text></Pressable></> : null}
    </View>}
    {message ? <Text accessibilityRole="alert" style={[styles.body, { color: theme.text }]}>{message}</Text> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: UI_LAYOUT.pageInset, paddingBottom: 48, gap: UI_LAYOUT.sectionGap },
  heading: { fontSize: 28, fontWeight: '800', marginTop: 10 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: UI_LAYOUT.groupRadius, padding: 16, gap: 14 },
  title: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  button: { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
});
