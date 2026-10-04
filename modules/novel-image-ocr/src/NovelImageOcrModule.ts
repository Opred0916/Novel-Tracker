import { NativeModule, requireNativeModule } from 'expo';

declare class NovelImageOcrModule extends NativeModule<{}> {
  recognize(localPath: string): Promise<string>;
}

export default requireNativeModule<NovelImageOcrModule>('NovelImageOcr');
