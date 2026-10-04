import { registerWebModule, NativeModule } from 'expo';

// NovelImageOcrModule is not available on the web platform.
class NovelImageOcrModule extends NativeModule<{}> {}

export default registerWebModule(NovelImageOcrModule, 'NovelImageOcrModule');
