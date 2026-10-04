import * as ImagePicker from 'expo-image-picker';
import { pickImportScreenshots } from '../../src/import/screenshotImportPlatform';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const requestPermission = jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync);
const launchPicker = jest.mocked(ImagePicker.launchImageLibraryAsync);

beforeEach(() => jest.clearAllMocks());

test('returns the ordered image uris from a multi-select picker', async () => {
  requestPermission.mockResolvedValue({ granted: true } as never);
  launchPicker.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///one.png' }, { uri: 'file:///two.png' }] } as never);
  await expect(pickImportScreenshots()).resolves.toEqual(['file:///one.png', 'file:///two.png']);
  expect(launchPicker).toHaveBeenCalledWith(expect.objectContaining({
    mediaTypes: ['images'], allowsMultipleSelection: true, orderedSelection: true, selectionLimit: 20,
  }));
});

test('returns null when permission is denied or selection is cancelled', async () => {
  requestPermission.mockResolvedValueOnce({ granted: false } as never);
  await expect(pickImportScreenshots()).resolves.toBeNull();
  requestPermission.mockResolvedValueOnce({ granted: true } as never);
  launchPicker.mockResolvedValueOnce({ canceled: true, assets: null } as never);
  await expect(pickImportScreenshots()).resolves.toBeNull();
});

test('rejects a picker result larger than the batch limit', async () => {
  requestPermission.mockResolvedValue({ granted: true } as never);
  launchPicker.mockResolvedValue({ canceled: false, assets: Array.from({ length: 21 }, (_, index) => ({ uri: `file:///${index}.png` })) } as never);
  await expect(pickImportScreenshots()).rejects.toThrow('20');
});
