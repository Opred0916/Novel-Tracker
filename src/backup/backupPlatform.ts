import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/octet-stream', 'application/x-noveltracker'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

export async function shareBackup(uri: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('当前设备不支持系统分享');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/zip',
    dialogTitle: '保存 Novel Tracker 备份',
    UTI: 'public.zip-archive',
  });
}
