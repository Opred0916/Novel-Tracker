import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';

export class RecapSharePlatformError extends Error {
  constructor(public readonly code: 'permission_denied' | 'unavailable' | 'failed', cause?: unknown) {
    super(code);
    this.name = 'RecapSharePlatformError';
    this.cause = cause;
  }
}

export async function captureRecapPng(view: View): Promise<string> {
  try { return await captureRef(view, { format: 'png', result: 'tmpfile', quality: 1 }); }
  catch (cause) { throw new RecapSharePlatformError('failed', cause); }
}

export async function saveRecapPng(uri: string): Promise<void> {
  try {
    const permission = await requestPermissionsAsync(true, ['photo']);
    if (!permission.granted) throw new RecapSharePlatformError('permission_denied');
    await Asset.create(uri);
  } catch (cause) {
    if (cause instanceof RecapSharePlatformError) throw cause;
    throw new RecapSharePlatformError('failed', cause);
  }
}

export async function shareRecapPng(uri: string): Promise<void> {
  try {
    if (!await Sharing.isAvailableAsync()) throw new RecapSharePlatformError('unavailable');
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
  } catch (cause) {
    if (cause instanceof RecapSharePlatformError) throw cause;
    throw new RecapSharePlatformError('failed', cause);
  }
}

export function discardRecapPng(uri: string): void {
  try { new File(uri).delete(); } catch { /* Temporary cache cleanup is best-effort. */ }
}
