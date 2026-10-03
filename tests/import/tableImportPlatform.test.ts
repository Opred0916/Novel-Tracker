import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { pickImportTable } from '../../src/import/importPlatform';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

test('accepts CSV and XLSX, checks size, and keeps cancellation harmless', async () => {
  jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: true, assets: [] } as never);
  await expect(pickImportTable()).resolves.toBeNull();
  jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'memory://books.csv', name: 'books.csv', size: 3 }] } as never);
  jest.mocked(File).mockImplementationOnce(() => ({ size: 3, bytes: async () => new Uint8Array([1, 2, 3]) }) as never);
  await expect(pickImportTable()).resolves.toMatchObject({ name: 'books.csv', kind: 'csv' });
  jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'memory://books.xls', name: 'books.xls', size: 3 }] } as never);
  await expect(pickImportTable()).rejects.toThrow('CSV 或 XLSX');
});
