import { createLocalImageTextRecognizer } from '../../src/books/localImageTextRecognizer';

test('recognizes a local path through the optional native module', async () => {
  const nativeModule = { recognize: jest.fn().mockResolvedValue('识别文字') };
  const recognizer = createLocalImageTextRecognizer(nativeModule);
  expect(recognizer.isAvailable()).toBe(true);
  await expect(recognizer.recognize('file:///book/image.jpg')).resolves.toBe('识别文字');
  expect(nativeModule.recognize).toHaveBeenCalledWith('file:///book/image.jpg');
});

test('falls back safely when the native module is unavailable', async () => {
  const recognizer = createLocalImageTextRecognizer(null);
  expect(recognizer.isAvailable()).toBe(false);
  await expect(recognizer.recognize('file:///book/image.jpg')).rejects.toMatchObject({ code: 'native_unavailable' });
});
