import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { MAX_IMPORT_BYTES } from './textImportParser';

export async function pickImportTxt(): Promise<{ name: string; bytes: Uint8Array } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'text/*'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  if (asset.size !== undefined && asset.size > MAX_IMPORT_BYTES) throw new Error('TXT 文件不能超过 1 MiB');
  const file = new File(asset.uri);
  if (file.size > MAX_IMPORT_BYTES) throw new Error('TXT 文件不能超过 1 MiB');
  return { name: asset.name ?? 'import.txt', bytes: await file.bytes() };
}
