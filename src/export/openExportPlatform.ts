import * as Sharing from 'expo-sharing';

export async function shareOpenExport(uri: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('当前设备不支持系统分享');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/zip',
    dialogTitle: '保存 Novel Tracker 开放格式导出',
    UTI: 'public.zip-archive',
  });
}
