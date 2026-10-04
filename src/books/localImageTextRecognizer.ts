import { requireOptionalNativeModule } from 'expo';

export type NativeImageOcrModule = { recognize(localPath: string): Promise<string> };

export type LocalImageTextRecognizer = {
  isAvailable(): boolean;
  recognize(localPath: string): Promise<string>;
};

export class LocalImageTextRecognizerError extends Error {
  constructor(public readonly code: 'native_unavailable' | 'recognition_failed', message: string) {
    super(message);
    this.name = 'LocalImageTextRecognizerError';
  }
}

export function createLocalImageTextRecognizer(nativeModule: NativeImageOcrModule | null): LocalImageTextRecognizer {
  return {
    isAvailable: () => nativeModule !== null,
    recognize: async (localPath: string) => {
      if (!nativeModule) throw new LocalImageTextRecognizerError('native_unavailable', '本地图片文字识别不可用');
      try {
        return await nativeModule.recognize(localPath);
      } catch {
        throw new LocalImageTextRecognizerError('recognition_failed', '图片文字识别失败');
      }
    },
  };
}

export function getLocalImageTextRecognizer(): LocalImageTextRecognizer {
  let nativeModule: NativeImageOcrModule | null = null;
  try {
    nativeModule = requireOptionalNativeModule<NativeImageOcrModule>('NovelImageOcr');
  } catch {
    nativeModule = null;
  }
  return createLocalImageTextRecognizer(nativeModule);
}
