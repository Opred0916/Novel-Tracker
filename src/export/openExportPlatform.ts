import * as Sharing from 'expo-sharing';

export class OpenExportShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenExportShareError';
  }
}

export async function shareOpenExport(uri: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new OpenExportShareError('当前设备不支持系统分享');
  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/zip',
      dialogTitle: '保存 Novel Tracker 开放格式导出',
      UTI: 'public.zip-archive',
    });
  } catch {
    throw new OpenExportShareError('无法打开系统分享面板');
  }
}
