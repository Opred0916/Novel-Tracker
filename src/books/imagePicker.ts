import * as ImagePicker from 'expo-image-picker';

export async function pickImages(): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.9,
  });
  if (result.canceled) return [];
  return result.assets.map(asset => asset.uri);
}
