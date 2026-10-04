import * as ImagePicker from 'expo-image-picker';

export const MAX_SCREENSHOT_IMPORT_PAGES = 20;

export async function pickImportScreenshots(): Promise<string[] | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    orderedSelection: true,
    selectionLimit: MAX_SCREENSHOT_IMPORT_PAGES,
    quality: 0.9,
  });
  if (result.canceled) return null;
  const uris = result.assets.map(asset => asset.uri).filter(Boolean);
  if (uris.length > MAX_SCREENSHOT_IMPORT_PAGES) throw new Error(`一次最多选择 ${MAX_SCREENSHOT_IMPORT_PAGES} 张截图`);
  return uris;
}

export async function cleanupImportScreenshotCopies(_uris: string[]): Promise<void> {
  // The first implementation passes through photo-library URIs and does not create copies.
}
