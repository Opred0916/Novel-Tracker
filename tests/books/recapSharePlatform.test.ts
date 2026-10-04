import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { captureRecapPng, discardRecapPng, saveRecapPng, shareRecapPng } from '../../src/books/recapSharePlatform';

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('expo-media-library', () => ({ requestPermissionsAsync: jest.fn(), Asset: { create: jest.fn() } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

const uri = 'file:///cache/recap.png';
beforeEach(() => jest.clearAllMocks());

test('captures a local png', async () => {
  jest.mocked(captureRef).mockResolvedValue(uri);
  expect(await captureRecapPng({} as never)).toBe(uri);
  expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ format: 'png', result: 'tmpfile' }));
});

test('writes asset only after photo permission', async () => {
  jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({ granted: true } as never);
  await saveRecapPng(uri);
  expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(true, ['photo']);
  expect(MediaLibrary.Asset.create).toHaveBeenCalledWith(uri);
});

test('denial does not write the asset', async () => {
  jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({ granted: false } as never);
  await expect(saveRecapPng(uri)).rejects.toMatchObject({ code: 'permission_denied' });
  expect(MediaLibrary.Asset.create).not.toHaveBeenCalled();
});

test('opens system share sheet but does not claim delivery', async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  await shareRecapPng(uri);
  expect(Sharing.shareAsync).toHaveBeenCalledWith(uri, expect.objectContaining({ mimeType: 'image/png', UTI: 'public.png' }));
});

test('unavailable share does not open a sheet', async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
  await expect(shareRecapPng(uri)).rejects.toMatchObject({ code: 'unavailable' });
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

test('cleanup failure is nonfatal', () => {
  jest.mocked(File).mockImplementation(() => ({ delete: () => { throw new Error('cleanup'); } }) as never);
  expect(() => discardRecapPng(uri)).not.toThrow();
});
