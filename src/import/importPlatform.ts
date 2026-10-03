import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { MAX_IMPORT_BYTES } from './textImportParser';
import { MAX_XLSX_BYTES } from './tableImportParser';

export async function pickImportTable(): Promise<{ name: string; kind: 'csv' | 'xlsx'; bytes: Uint8Array } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], copyToCacheDirectory: true, multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  const name = asset.name ?? 'import.csv';
  const lower = name.toLocaleLowerCase();
  const kind = lower.endsWith('.csv') ? 'csv' : lower.endsWith('.xlsx') ? 'xlsx' : null;
  if (!kind) throw new Error('请选择 CSV 或 XLSX 文件（不支持 XLS）');
  const limit = kind === 'csv' ? MAX_IMPORT_BYTES : MAX_XLSX_BYTES;
  if (asset.size !== undefined && asset.size > limit) throw new Error(`${kind.toUpperCase()} 文件超过大小限制`);
  const file = new File(asset.uri);
  if (file.size > limit) throw new Error(`${kind.toUpperCase()} 文件超过大小限制`);
  return { name, kind, bytes: await file.bytes() };
}

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
