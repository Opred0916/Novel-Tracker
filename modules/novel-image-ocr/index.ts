// Re-export the native module. On web, it will be resolved to NovelImageOcrModule.web.ts
// and on native platforms to NovelImageOcrModule.ts
export { default } from './src/NovelImageOcrModule';
export * from './src/NovelImageOcr.types';
